package version

import "regexp"

const (
	ReleaseClassMigrationBuild   = "migration-build"
	ReleaseClassReleaseCandidate = "release-candidate"
	ReleaseClassProductRelease   = "product-release"
	ReleaseClassDevelopment      = "development"
)

var (
	// Injected at build time via -ldflags "-X ..."
	AppVersion = "0.4.0-migration"
	GitSHA     = "unknown"
	BuildTime  = "unknown"
)

var (
	migrationBuildPattern   = regexp.MustCompile(`^0\.\d+\.\d+-migration$`)
	releaseCandidatePattern = regexp.MustCompile(`^(?:v)?1\.0\.0-rc\.\d+$`)
	productReleasePattern   = regexp.MustCompile(`^v[1-9]\d*\.\d+\.\d+$`)
)

type Info struct {
	Version      string `json:"version"`
	GitSHA       string `json:"git_sha"`
	BuildTime    string `json:"build_time"`
	ReleaseClass string `json:"release_class"`
}

func Get() Info {
	return Info{Version: AppVersion, GitSHA: GitSHA, BuildTime: BuildTime, ReleaseClass: Classify(AppVersion)}
}

func Classify(appVersion string) string {
	switch {
	case migrationBuildPattern.MatchString(appVersion):
		return ReleaseClassMigrationBuild
	case releaseCandidatePattern.MatchString(appVersion):
		return ReleaseClassReleaseCandidate
	case productReleasePattern.MatchString(appVersion):
		return ReleaseClassProductRelease
	default:
		return ReleaseClassDevelopment
	}
}
