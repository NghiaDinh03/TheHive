package workwrite

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestHashObservableDataKeepsSmallDataSearchable(t *testing.T) {
	indexed, full, hash := hashObservableData("  example.org  ")
	wantHash := "sha256:" + sha256Hex("example.org")
	if indexed != "example.org" {
		t.Fatalf("indexed data = %q, want original trimmed data", indexed)
	}
	if full != "" {
		t.Fatalf("full data = %q, want empty for small observable", full)
	}
	if hash != wantHash {
		t.Fatalf("hash = %q, want %q", hash, wantHash)
	}
}

func TestHashObservableDataUsesHashToIndexForHugeData(t *testing.T) {
	value := strings.Repeat("a", observableHashToIndexThreshold+1)
	indexed, full, hash := hashObservableData(value)
	wantHash := "sha256:" + sha256Hex(value)
	if indexed != wantHash {
		t.Fatalf("indexed data = %q, want sha256 hash", indexed)
	}
	if full != value {
		t.Fatalf("full data length = %d, want %d", len(full), len(value))
	}
	if hash != wantHash {
		t.Fatalf("hash = %q, want %q", hash, wantHash)
	}
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
