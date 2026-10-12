package catalog

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

const (
	maxUploadBody = 16 << 20 // the whole multipart body
	maxImage      = 5 << 20  // the file part
)

// imageExt maps the types http.DetectContentType reports to file extensions.
var imageExt = map[string]string{"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}

// imageTypes maps a stored extension back to its Content-Type for the file route.
var imageTypes = map[string]string{"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}

// fileName is the only shape of name the file route serves.
var fileName = regexp.MustCompile(`^[a-z0-9-]+\.(png|jpg|webp)$`)

var (
	errNoFile       = invalid("file", "multipart/form-data with a file part is required")
	errTooLarge     = invalid("file", "image larger than 5 MiB")
	errType         = invalid("file", "image must be PNG, JPEG or WebP")
	errBodyTooLarge = &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Message: "body too large"}
)

// bodyErr maps a read error from the body: over the limit is body too large;
// anything else means the file part is unreadable.
func bodyErr(err error) error {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return errBodyTooLarge
	}
	return errNoFile
}

// readImage returns the bytes of the body's file part and the extension its
// content says it is. The client's Content-Type and file name are ignored.
// Other parts are read and dropped, so the body limit covers them too.
func readImage(w http.ResponseWriter, r *http.Request) ([]byte, string, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBody)
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, "", errNoFile
	}
	for {
		p, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, "", errNoFile
		}
		if err != nil {
			return nil, "", bodyErr(err)
		}
		if p.FormName() != "file" {
			if _, err := io.Copy(io.Discard, p); err != nil {
				return nil, "", bodyErr(err)
			}
			continue
		}
		// Read one byte past the cap, so an oversize file is seen without reading all of it.
		data, err := io.ReadAll(io.LimitReader(p, maxImage+1))
		if err != nil {
			return nil, "", bodyErr(err)
		}
		if len(data) > maxImage {
			return nil, "", errTooLarge
		}
		ext, ok := imageExt[http.DetectContentType(data)]
		if !ok {
			return nil, "", errType
		}
		return data, ext, nil
	}
}

// storeImage reads the upload and stores it as kind/id.ext, returning the key.
// ponytail: files are never deleted; deleting a product or category leaves its file on disk. A core-admin sweep of unreferenced keys is the upgrade path.
func (c *Catalog) storeImage(w http.ResponseWriter, r *http.Request, kind, id string) (string, error) {
	data, ext, err := readImage(w, r)
	if err != nil {
		return "", err
	}
	key := kind + "/" + id + "." + ext
	if err := c.files.Put(r.Context(), key, data); err != nil {
		return "", fmt.Errorf("store image %s: %w", key, err)
	}
	return key, nil
}

// PutProductImage answers 200 with the product, its imageUrl now the new file.
// An unknown id is 404 before the body is read, so nothing is stored for it.
func (c *Catalog) PutProductImage(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := c.q.GetProduct(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	key, err := c.storeImage(w, r, "products", row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	updated, err := c.q.SetProductImage(r.Context(), db.SetProductImageParams{ID: row.ID, ImageKey: key})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toProduct(updated))
}

// PutCategoryImage answers 200 with the category, its imageUrl now the new file.
// An unknown id is 404 before the body is read.
func (c *Catalog) PutCategoryImage(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := c.q.GetCategory(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	key, err := c.storeImage(w, r, "categories", row.ID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	updated, err := c.q.SetCategoryImage(r.Context(), db.SetCategoryImageParams{ID: row.ID, ImageKey: key})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toCategory(updated))
}

// File serves a stored catalog image publicly. Only kind products or
// categories and a name matching fileName are looked up; anything else, and a
// missing file, is 404. The response is revalidated on every request, since a
// re-upload keeps the same URL.
func (c *Catalog) File(w http.ResponseWriter, r *http.Request) {
	kind, name := chi.URLParam(r, "kind"), chi.URLParam(r, "name")
	if (kind != "products" && kind != "categories") || !fileName.MatchString(name) {
		httpx.WriteError(w, r, notFound)
		return
	}
	f, modTime, err := c.files.Open(r.Context(), kind+"/"+name)
	if errors.Is(err, fs.ErrNotExist) {
		httpx.WriteError(w, r, notFound)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	defer f.Close()
	ext := name[strings.LastIndexByte(name, '.')+1:]
	w.Header().Set("Content-Type", imageTypes[ext])
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, modTime, f)
}
