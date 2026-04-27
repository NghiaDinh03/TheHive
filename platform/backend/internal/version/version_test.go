package version

import "testing"

func TestClassifyMigrationBuild(t *testing.T) {
	if got := Classify("0.4.1-migration"); got != ReleaseClassMigrationBuild {
		t.Fatalf("expected %s, got %s", ReleaseClassMigrationBuild, got)
	}
}

func TestClassifyReleaseCandidate(t *testing.T) {
	for _, input := range []string{"1.0.0-rc.1", "v1.0.0-rc.2"} {
		if got := Classify(input); got != ReleaseClassReleaseCandidate {
			t.Fatalf("expected %s for %s, got %s", ReleaseClassReleaseCandidate, input, got)
		}
	}
}

func TestClassifyProductRelease(t *testing.T) {
	for _, input := range []string{"v1.0.0", "v1.2.3", "v2.0.0"} {
		if got := Classify(input); got != ReleaseClassProductRelease {
			t.Fatalf("expected %s for %s, got %s", ReleaseClassProductRelease, input, got)
		}
	}
}

func TestClassifyDevelopmentFallback(t *testing.T) {
	for _, input := range []string{"0.4.1", "1.0.0", "dev", "0.4.1-dev"} {
		if got := Classify(input); got != ReleaseClassDevelopment {
			t.Fatalf("expected %s for %s, got %s", ReleaseClassDevelopment, input, got)
		}
	}
}
