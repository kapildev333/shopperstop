// Package blob stores uploaded and demo files under keys such as
// "products/<name>.png". Disk is the only implementation; S3 comes later.
package blob

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// Store holds files by key. Nothing deletes files, so there is no Delete.
type Store interface {
	Put(ctx context.Context, key string, data []byte) error
	// Open returns fs.ErrNotExist (wrapped) when the key is absent; the time
	// is the file's modification time.
	Open(ctx context.Context, key string) (io.ReadSeekCloser, time.Time, error)
}

// Disk keeps each key as the file Dir/<key>.
type Disk struct{ Dir string }

// Put writes data to the key's file. It writes a temp file in the same
// directory and renames it over the target, so a reader never sees half a
// file and a re-upload replaces the old bytes in one step.
// ponytail: whole file in memory; the 5 MiB upload cap is the ceiling.
func (d Disk) Put(_ context.Context, key string, data []byte) error {
	path, err := d.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("blob put %s: %w", key, err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".upload-*")
	if err != nil {
		return fmt.Errorf("blob put %s: %w", key, err)
	}
	defer os.Remove(tmp.Name()) // no-op once the rename has moved it
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("blob put %s: %w", key, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("blob put %s: %w", key, err)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return fmt.Errorf("blob put %s: %w", key, err)
	}
	return nil
}

// Open returns the key's file and its modification time.
func (d Disk) Open(_ context.Context, key string) (io.ReadSeekCloser, time.Time, error) {
	path, err := d.path(key)
	if err != nil {
		return nil, time.Time{}, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("blob open %s: %w", key, err)
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, time.Time{}, fmt.Errorf("blob open %s: %w", key, err)
	}
	return f, info.ModTime(), nil
}

// path maps a key to a file under Dir and refuses keys that escape it.
func (d Disk) path(key string) (string, error) {
	if !filepath.IsLocal(filepath.FromSlash(key)) {
		return "", fmt.Errorf("blob key %q is not a local path", key)
	}
	return filepath.Join(d.Dir, filepath.FromSlash(key)), nil
}
