package attachmentzip

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"

	zipcrypto "github.com/alexmullins/zip"
)

func TestBuildCreatesPasswordEncryptedZip(t *testing.T) {
	result, err := Build("evidence.txt", "malware", []byte("ioc payload"))
	if err != nil {
		t.Fatalf("Build returned error: %v", err)
	}
	if result.FileName != "evidence.txt.zip" {
		t.Fatalf("FileName = %q, want evidence.txt.zip", result.FileName)
	}
	zr, err := zipcrypto.NewReader(bytes.NewReader(result.Bytes), int64(len(result.Bytes)))
	if err != nil {
		t.Fatalf("open zip: %v", err)
	}
	if len(zr.File) != 1 {
		t.Fatalf("zip entries = %d, want 1", len(zr.File))
	}
	entry := zr.File[0]
	if !entry.IsEncrypted() {
		t.Fatalf("zip entry is not encrypted")
	}
	entry.SetPassword("malware")
	rc, err := entry.Open()
	if err != nil {
		t.Fatalf("open encrypted entry with password: %v", err)
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read encrypted entry: %v", err)
	}
	if string(body) != "ioc payload" {
		t.Fatalf("body = %q, want original content only", string(body))
	}
}

func TestBuildPlainZipWhenPasswordEmpty(t *testing.T) {
	result, err := Build("evidence.txt", "", []byte("ioc payload"))
	if err != nil {
		t.Fatalf("Build returned error: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(result.Bytes), int64(len(result.Bytes)))
	if err != nil {
		t.Fatalf("open zip: %v", err)
	}
	if len(zr.File) != 1 {
		t.Fatalf("zip entries = %d, want 1", len(zr.File))
	}
	rc, err := zr.File[0].Open()
	if err != nil {
		t.Fatalf("open plain entry: %v", err)
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read plain entry: %v", err)
	}
	if string(body) != "ioc payload" {
		t.Fatalf("body = %q, want original content", string(body))
	}
}
