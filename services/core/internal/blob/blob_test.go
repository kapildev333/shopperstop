package blob_test

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/core/internal/blob"
)

func readAll(t *testing.T, s blob.Store, key string) []byte {
	t.Helper()
	f, _, err := s.Open(context.Background(), key)
	if err != nil {
		t.Fatalf("Open %s: %v", key, err)
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		t.Fatalf("read %s: %v", key, err)
	}
	return data
}

func TestDiskPutOpen(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "files")
	s := blob.Disk{Dir: dir}
	ctx := context.Background()

	if err := s.Put(ctx, "products/a.png", []byte("first")); err != nil {
		t.Fatalf("Put: %v", err)
	}
	if info, err := os.Stat(filepath.Join(dir, "products")); err != nil || !info.IsDir() {
		t.Fatalf("Put did not create products directory: %v", err)
	}
	info, err := os.Stat(filepath.Join(dir, "products", "a.png"))
	if err != nil {
		t.Fatalf("stat stored file: %v", err)
	}
	if info.Mode().Perm() != 0o644 {
		t.Errorf("stored file mode = %v, want 0644 so the web server can read it", info.Mode().Perm())
	}

	f, mod, err := s.Open(ctx, "products/a.png")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if string(data) != "first" {
		t.Errorf("Open bytes = %q, want %q", data, "first")
	}
	if d := time.Since(mod); d < -time.Minute || d > time.Minute {
		t.Errorf("modification time %v not within a minute of now", mod)
	}
}

func TestDiskPutReplaces(t *testing.T) {
	dir := t.TempDir()
	s := blob.Disk{Dir: dir}
	ctx := context.Background()

	if err := s.Put(ctx, "products/a.png", []byte("first")); err != nil {
		t.Fatalf("Put first: %v", err)
	}
	if err := s.Put(ctx, "products/a.png", []byte("second")); err != nil {
		t.Fatalf("Put second: %v", err)
	}
	if got := string(readAll(t, s, "products/a.png")); got != "second" {
		t.Errorf("after re-upload Open = %q, want %q", got, "second")
	}
	entries, err := os.ReadDir(filepath.Join(dir, "products"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != "a.png" {
		names := make([]string, 0, len(entries))
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("products directory holds %v, want only a.png", names)
	}
}

func TestDiskOpenMissing(t *testing.T) {
	s := blob.Disk{Dir: t.TempDir()}
	_, _, err := s.Open(context.Background(), "products/none.png")
	if !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("Open missing: err = %v, want fs.ErrNotExist", err)
	}
}

func TestDiskRefusesNonLocalKey(t *testing.T) {
	parent := t.TempDir()
	dir := filepath.Join(parent, "files")
	s := blob.Disk{Dir: dir}
	ctx := context.Background()

	for _, key := range []string{
		"../x.png",
		"/abs.png",
		"products/../products/x",
		"a//b",
		"a\\b",
		"products/.hidden",
		"products/a/b/c",
		"products",
		"",
	} {
		if err := s.Put(ctx, key, []byte("x")); err == nil {
			t.Errorf("Put %q: want error, got nil", key)
		}
		if _, _, err := s.Open(ctx, key); err == nil {
			t.Errorf("Open %q: want error, got nil", key)
		}
	}
	if _, err := os.Stat(filepath.Join(parent, "x.png")); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("traversal wrote outside Dir: stat err = %v", err)
	}
	if _, err := os.Stat(dir); !errors.Is(err, fs.ErrNotExist) {
		t.Errorf("refused keys created Dir: stat err = %v", err)
	}
}
