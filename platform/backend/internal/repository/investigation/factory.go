package investigation

import (
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type FactoryConfig struct {
	Source        string
	LegacyURL     string
	LegacyAPIKey  string
	LegacyTimeout time.Duration
}

func NewReader(db *sqlx.DB, cfg FactoryConfig) Reader {
	switch strings.ToLower(strings.TrimSpace(cfg.Source)) {
	case SourceDemo:
		return NewDemoReader()
	case SourceLegacy:
		return NewLegacyReader(NewLegacyClient(cfg.LegacyURL, cfg.LegacyAPIKey, cfg.LegacyTimeout))
	case SourcePostgres, "":
		return NewPostgresReader(db)
	default:
		return NewPostgresReader(db)
	}
}
