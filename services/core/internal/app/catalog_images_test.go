package app

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// part is one multipart part. A filename makes it a file part; contentType is
// the client's claim, which the server ignores.
type part struct {
	name        string
	filename    string
	contentType string
	data        []byte
}

// filePart is the upload's one part named file.
func filePart(data []byte) part {
	return part{name: "file", filename: "upload.bin", contentType: "image/png", data: data}
}

// upload sends parts as a multipart/form-data PUT to path and returns the status and body.
func upload(t *testing.T, path, token string, parts ...part) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for _, p := range parts {
		h := textproto.MIMEHeader{}
		disposition := `form-data; name="` + p.name + `"`
		if p.filename != "" {
			disposition += `; filename="` + p.filename + `"`
		}
		h.Set("Content-Disposition", disposition)
		if p.contentType != "" {
			h.Set("Content-Type", p.contentType)
		}
		w, err := mw.CreatePart(h)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write(p.data); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	return sendBody(t, http.MethodPut, path, token, mw.FormDataContentType(), buf.Bytes())
}

// sendBody sends raw bytes and returns the status and body.
func sendBody(t *testing.T, method, path, token, contentType string, body []byte) (int, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

// getFile reads path without a token, sending headers, and returns the response and body.
func getFile(t *testing.T, path string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp, body
}

// storedFile reads key, a kind/name path, from the files directory.
func storedFile(t *testing.T, key string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(filesDir, filepath.FromSlash(key)))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// pngBytes encodes a 4 by 4 image of one colour with image/png.
func pngBytes(t *testing.T, c color.Color) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for x := range 4 {
		for y := range 4 {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// padded returns head followed by zeros, size bytes in all.
func padded(head []byte, size int) []byte {
	return append(head, make([]byte, size-len(head))...)
}

var (
	jpegHead = []byte{0xff, 0xd8, 0xff, 0xe0}
	webpHead = []byte("RIFF\x00\x00\x00\x00WEBPVP8 ")
	gifHead  = []byte("GIF89a")
)

const (
	imageMessage = "image must be PNG, JPEG or WebP"
	fileRequired = "multipart/form-data with a file part is required"
)

// productImagePath and categoryImagePath are the upload paths for an id.
func productImagePath(id string) string  { return productsPath + "/" + id + "/image" }
func categoryImagePath(id string) string { return categoriesPath + "/" + id + "/image" }

func TestUploadProductPNG(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Product PNG Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Product PNG"))
	data := pngBytes(t, color.RGBA{R: 200, A: 255})

	status, body := upload(t, productImagePath(p.ID), token, filePart(data))
	if status != http.StatusOK {
		t.Fatalf("upload: got %d %s, want 200", status, body)
	}
	var got productView
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	wantURL := "/api/core/v1/files/products/" + p.ID + ".png"
	if got.ImageURL != wantURL {
		t.Fatalf("imageUrl: got %q, want %q", got.ImageURL, wantURL)
	}
	if !bytes.Equal(storedFile(t, "products/"+p.ID+".png"), data) {
		t.Fatal("stored file differs from the upload")
	}

	resp, served := getFile(t, got.ImageURL, nil)
	if resp.StatusCode != http.StatusOK || resp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("file: got %d %q, want 200 image/png", resp.StatusCode, resp.Header.Get("Content-Type"))
	}
	if resp.Header.Get("Cache-Control") != "no-cache" || resp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("file headers: Cache-Control %q, X-Content-Type-Options %q", resp.Header.Get("Cache-Control"), resp.Header.Get("X-Content-Type-Options"))
	}
	if !bytes.Equal(served, data) {
		t.Fatal("served bytes differ from the upload")
	}

	// HEAD answers the same headers with no body.
	req, err := http.NewRequest(http.MethodHead, srv.URL+got.ImageURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	headResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	headResp.Body.Close()
	if headResp.StatusCode != http.StatusOK || headResp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("HEAD file: got %d %q, want 200 image/png", headResp.StatusCode, headResp.Header.Get("Content-Type"))
	}

	status, read := getProduct(t, token, p.ID)
	var admin productView
	if status != http.StatusOK || json.Unmarshal(read, &admin) != nil || admin.ImageURL != wantURL {
		t.Fatalf("GET product: got %d %s, want imageUrl %s", status, read, wantURL)
	}
}

func TestUploadCategoryWebPAndProductJPEG(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Category WebP"})
	webp := append(webpHead, make([]byte, 64)...)
	status, body := upload(t, categoryImagePath(cat.ID), token, part{name: "file", filename: "a.webp", data: webp})
	var c categoryView
	if status != http.StatusOK || json.Unmarshal(body, &c) != nil {
		t.Fatalf("category upload: got %d %s, want 200", status, body)
	}
	if want := "/api/core/v1/files/categories/" + cat.ID + ".webp"; c.ImageURL != want {
		t.Fatalf("category imageUrl: got %q, want %q", c.ImageURL, want)
	}
	if !bytes.Equal(storedFile(t, "categories/"+cat.ID+".webp"), webp) {
		t.Fatal("stored category file differs from the upload")
	}
	if resp, _ := getFile(t, c.ImageURL, nil); resp.Header.Get("Content-Type") != "image/webp" {
		t.Fatalf("category file type: got %q, want image/webp", resp.Header.Get("Content-Type"))
	}

	p := createProduct(t, token, productBody(cat.ID, "Upload Product JPEG"))
	jpeg := padded(jpegHead, 64)
	status, body = upload(t, productImagePath(p.ID), token, filePart(jpeg))
	var got productView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("product upload: got %d %s, want 200", status, body)
	}
	if want := "/api/core/v1/files/products/" + p.ID + ".jpg"; got.ImageURL != want {
		t.Fatalf("product imageUrl: got %q, want %q", got.ImageURL, want)
	}
	if !bytes.Equal(storedFile(t, "products/"+p.ID+".jpg"), jpeg) {
		t.Fatal("stored product file differs from the upload")
	}
	if resp, _ := getFile(t, got.ImageURL, nil); resp.Header.Get("Content-Type") != "image/jpeg" {
		t.Fatalf("product file type: got %q, want image/jpeg", resp.Header.Get("Content-Type"))
	}
}

func TestUploadReplaces(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Replaces Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Replaces"))
	first := pngBytes(t, color.RGBA{R: 10, A: 255})
	second := pngBytes(t, color.RGBA{G: 240, A: 255})
	if status, body := upload(t, productImagePath(p.ID), token, filePart(first)); status != http.StatusOK {
		t.Fatalf("first upload: got %d %s", status, body)
	}
	status, body := upload(t, productImagePath(p.ID), token, filePart(second))
	var got productView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("second upload: got %d %s", status, body)
	}
	if !bytes.Equal(storedFile(t, "products/"+p.ID+".png"), second) {
		t.Fatal("re-upload with the same type did not replace the stored bytes")
	}
	if _, served := getFile(t, got.ImageURL, nil); !bytes.Equal(served, second) {
		t.Fatal("served bytes after re-upload are not the second image")
	}

	// A JPEG switches the URL to .jpg; the old .png is left on disk.
	jpeg := padded(jpegHead, 64)
	status, body = upload(t, productImagePath(p.ID), token, part{name: "file", filename: "a.jpg", data: jpeg})
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("jpeg upload: got %d %s", status, body)
	}
	if want := "/api/core/v1/files/products/" + p.ID + ".jpg"; got.ImageURL != want {
		t.Fatalf("imageUrl after jpeg: got %q, want %q", got.ImageURL, want)
	}
	if _, served := getFile(t, got.ImageURL, nil); !bytes.Equal(served, jpeg) {
		t.Fatal("served bytes after the jpeg upload are not the jpeg")
	}
}

func TestFileNotModified(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Not Modified Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Not Modified"))
	if status, body := upload(t, productImagePath(p.ID), token, filePart(pngBytes(t, color.Black))); status != http.StatusOK {
		t.Fatalf("upload: got %d %s", status, body)
	}
	url := "/api/core/v1/files/products/" + p.ID + ".png"
	resp, _ := getFile(t, url, nil)
	lastModified := resp.Header.Get("Last-Modified")
	if lastModified == "" {
		t.Fatal("file has no Last-Modified header")
	}
	resp, body := getFile(t, url, map[string]string{"If-Modified-Since": lastModified})
	if resp.StatusCode != http.StatusNotModified || len(body) != 0 {
		t.Fatalf("If-Modified-Since: got %d with %d bytes, want 304 and no body", resp.StatusCode, len(body))
	}
}

func TestUploadWrongType(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Wrong Type Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Wrong Type"))
	cases := []struct {
		what string
		data []byte
	}{
		// The client's image/png claim is ignored: the bytes say GIF.
		{"gif claimed as png", append(gifHead, make([]byte, 64)...)},
		{"plain text", []byte("hello, this is not an image")},
	}
	for _, c := range cases {
		status, body := upload(t, productImagePath(p.ID), token, part{name: "file", filename: "x.png", contentType: "image/png", data: c.data})
		expectError(t, c.what, status, body, http.StatusBadRequest, "validation", "file", imageMessage)
	}
	if status, body := getProduct(t, token, p.ID); status != http.StatusOK || strings.Contains(string(body), "imageUrl") {
		t.Fatalf("refused upload left an image: %d %s", status, body)
	}
}

func TestUploadOver5MiB(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Over 5 MiB Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Over 5 MiB"))
	const max = 5 << 20
	status, body := upload(t, productImagePath(p.ID), token, filePart(padded(pngBytes(t, color.Black), max+1)))
	expectError(t, "5 MiB + 1", status, body, http.StatusBadRequest, "validation", "file", "image larger than 5 MiB")

	// Exactly 5 MiB is accepted.
	if status, body := upload(t, productImagePath(p.ID), token, filePart(padded(pngBytes(t, color.Black), max))); status != http.StatusOK {
		t.Fatalf("exactly 5 MiB: got %d %s, want 200", status, body)
	}
}

func TestUploadMissingPartOrNotMultipart(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Missing Part Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Missing Part"))
	status, body := upload(t, productImagePath(p.ID), token, part{name: "name", data: []byte("no file here")})
	expectError(t, "no file part", status, body, http.StatusBadRequest, "validation", "file", fileRequired)

	status, body = call(t, http.MethodPut, productImagePath(p.ID), token, map[string]string{"file": "not multipart"})
	expectError(t, "JSON body", status, body, http.StatusBadRequest, "validation", "file", fileRequired)
}

func TestUploadBodyOver16MiB(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Body Over 16 MiB"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Body Over 16 MiB"))
	// A 17 MiB part before the file: the body limit trips while the part is skipped.
	pad := make([]byte, 17<<20)
	status, body := upload(t, productImagePath(p.ID), token, part{name: "pad", data: pad}, filePart(pngBytes(t, color.Black)))
	expectError(t, "17 MiB body", status, body, http.StatusBadRequest, "validation", "", "body too large")
}

func TestUploadUnknownProduct(t *testing.T) {
	token := adminToken(t)
	status, body := upload(t, productImagePath(missingProductID), token, filePart(pngBytes(t, color.Black)))
	expectError(t, "unknown product", status, body, http.StatusNotFound, "not_found", "", "")
	if _, err := os.Stat(filepath.Join(filesDir, "products", missingProductID+".png")); !os.IsNotExist(err) {
		t.Fatalf("unknown product stored a file: %v", err)
	}
}

func TestUploadUnknownCategory(t *testing.T) {
	token := adminToken(t)
	status, body := upload(t, categoryImagePath(missingCategoryID), token, filePart(pngBytes(t, color.Black)))
	expectError(t, "unknown category", status, body, http.StatusNotFound, "not_found", "", "")
}

func TestFileMissing(t *testing.T) {
	resp, body := getFile(t, "/api/core/v1/files/products/00000000-0000-4000-8000-0000000006fe.png", nil)
	expectError(t, "missing file", resp.StatusCode, body, http.StatusNotFound, "not_found", "", "")
}

func TestFileUnsafeNameOrKind(t *testing.T) {
	for _, path := range []string{
		"/api/core/v1/files/products/..%2Fsecret.png",
		"/api/core/v1/files/orders/x.png",
		"/api/core/v1/files/products/X.PNG",
	} {
		resp, body := getFile(t, path, nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("GET %s: got %d %s, want 404", path, resp.StatusCode, body)
		}
	}
}

// TestUploadRefusesSVGAndHTML renames active documents to .png: the content
// decides, so both are refused.
func TestUploadRefusesSVGAndHTML(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload SVG HTML Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload SVG HTML"))
	cases := []struct {
		what string
		data []byte
	}{
		{"svg with script", []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)},
		{"html with script", []byte(`<!DOCTYPE html><html><body><script>alert(1)</script></body></html>`)},
	}
	for _, c := range cases {
		status, body := upload(t, productImagePath(p.ID), token, part{name: "file", filename: "x.png", contentType: "image/png", data: c.data})
		expectError(t, c.what, status, body, http.StatusBadRequest, "validation", "file", imageMessage)
	}
}

// TestUploadFilenameIgnored sends a traversal file name: the stored key is
// kind/id.ext, and nothing lands outside the kind directory.
func TestUploadFilenameIgnored(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Traversal Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Traversal"))
	data := pngBytes(t, color.RGBA{B: 180, A: 255})
	status, body := upload(t, productImagePath(p.ID), token, part{name: "file", filename: "../../evil.png", contentType: "image/png", data: data})
	if status != http.StatusOK {
		t.Fatalf("upload: got %d %s, want 200", status, body)
	}
	if !bytes.Equal(storedFile(t, "products/"+p.ID+".png"), data) {
		t.Fatal("stored file differs from the upload")
	}
	for _, outside := range []string{
		filepath.Join(filesDir, "evil.png"),
		filepath.Join(filesDir, "products", "evil.png"),
		filepath.Join(filesDir, "..", "..", "evil.png"),
	} {
		if _, err := os.Stat(outside); !os.IsNotExist(err) {
			t.Fatalf("upload with a traversal name wrote %s: %v", outside, err)
		}
	}
}

// TestUploadTwoFileParts pins what happens with two file parts: the first is stored.
func TestUploadTwoFileParts(t *testing.T) {
	token := adminToken(t)
	cat := createCategory(t, token, map[string]any{"name": "Upload Two Parts Category"})
	p := createProduct(t, token, productBody(cat.ID, "Upload Two Parts"))
	first := pngBytes(t, color.RGBA{R: 1, A: 255})
	second := pngBytes(t, color.RGBA{R: 2, A: 255})
	status, body := upload(t, productImagePath(p.ID), token, filePart(first), filePart(second))
	if status != http.StatusOK {
		t.Fatalf("two file parts: got %d %s, want 200", status, body)
	}
	if !bytes.Equal(storedFile(t, "products/"+p.ID+".png"), first) {
		t.Fatal("two file parts: the second part was stored, want the first")
	}
}

// TestFileTraversalPaths asks for paths outside the catalog file shape; all are 404.
func TestFileTraversalPaths(t *testing.T) {
	for _, path := range []string{
		"/api/core/v1/files/etc/passwd",
		"/api/core/v1/files/categories/%2e%2e/x.png",
		"/api/core/v1/files/products/%2e%2e.png",
	} {
		resp, body := getFile(t, path, nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("GET %s: got %d %s, want 404", path, resp.StatusCode, body)
		}
	}
}
