package handler

// Admin endpoints for taxonomy, MITRE ATT&CK pattern catalogue, and custom
// field definitions. These mirror TheHive 4 admin partials at
// frontend/app/views/partials/admin/{taxonomy,attack,custom-fields}*.html and
// expose the CRUD surface needed by the new Next.js admin pages.

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
	"github.com/thehive-platform/backend/internal/apierr"
	"github.com/thehive-platform/backend/internal/audit"
)

type AdminCatalogHandler struct {
	db    *sqlx.DB
	audit *audit.Recorder
}

func NewAdminCatalogHandler(db *sqlx.DB, auditRecorder *audit.Recorder) *AdminCatalogHandler {
	return &AdminCatalogHandler{db: db, audit: auditRecorder}
}

// ---------- Custom field definitions ----------

type customFieldDef struct {
	ID          string         `db:"id" json:"id"`
	Reference   string         `db:"reference" json:"reference"`
	Name        string         `db:"name" json:"name"`
	Description string         `db:"description" json:"description"`
	FieldType   string         `db:"field_type" json:"type"`
	Mandatory   bool           `db:"mandatory" json:"mandatory"`
	Options     pq.StringArray `db:"options" json:"options"`
	CreatedBy   string         `db:"created_by" json:"created_by"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

type customFieldDefRequest struct {
	Reference   string   `json:"reference" validate:"required,min=1"`
	Name        string   `json:"name" validate:"required,min=1"`
	Description string   `json:"description"`
	Type        string   `json:"type"`
	Mandatory   bool     `json:"mandatory"`
	Options     []string `json:"options"`
}

func (h *AdminCatalogHandler) ListCustomFieldDefs(c echo.Context) error {
	rows := []customFieldDef{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT id::text, reference, name, description, field_type, mandatory, options, created_by, created_at, updated_at
		FROM custom_field_definitions ORDER BY name`); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AdminCatalogHandler) UpsertCustomFieldDef(c echo.Context) error {
	var req customFieldDefRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	fieldType := strings.TrimSpace(req.Type)
	if fieldType == "" {
		fieldType = "string"
	}
	switch fieldType {
	case "string", "integer", "float", "boolean", "date", "enumeration":
	default:
		return apierr.New(http.StatusBadRequest, "invalid field_type")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field save failed")
	}
	defer func() { _ = tx.Rollback() }()
	_, err = tx.ExecContext(c.Request().Context(), `
		INSERT INTO custom_field_definitions (reference, name, description, field_type, mandatory, options, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (reference) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			field_type = EXCLUDED.field_type,
			mandatory = EXCLUDED.mandatory,
			options = EXCLUDED.options,
			updated_at = now()`,
		req.Reference, req.Name, req.Description, fieldType, req.Mandatory,
		pq.StringArray(req.Options), actorLogin(c))
	if err != nil {
		return apierr.New(http.StatusBadRequest, "custom field save failed: "+err.Error())
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.custom_field.upsert", "custom_field_definition", req.Reference, nil, req))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field save failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"reference": req.Reference, "status": "saved"})
}

func (h *AdminCatalogHandler) DeleteCustomFieldDef(c echo.Context) error {
	reference := strings.TrimSpace(c.Param("reference"))
	if reference == "" {
		return apierr.New(http.StatusBadRequest, "missing reference")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field delete failed")
	}
	defer func() { _ = tx.Rollback() }()
	res, err := tx.ExecContext(c.Request().Context(), `DELETE FROM custom_field_definitions WHERE reference = $1`, reference)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field delete failed")
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return apierr.New(http.StatusNotFound, "custom field not found")
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.custom_field.delete", "custom_field_definition", reference, map[string]string{"reference": reference}, nil))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "custom field delete failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"reference": reference, "status": "deleted"})
}

// ---------- Taxonomy catalogue ----------

type taxonomyRow struct {
	ID          string    `db:"id" json:"id"`
	Namespace   string    `db:"namespace" json:"namespace"`
	Description string    `db:"description" json:"description"`
	Version     int       `db:"version" json:"version"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Source      string    `db:"source" json:"source"`
	CreatedBy   string    `db:"created_by" json:"created_by"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type taxonomyPredicate struct {
	ID          string `db:"id" json:"id"`
	TaxonomyID  string `db:"taxonomy_id" json:"taxonomy_id"`
	Value       string `db:"value" json:"value"`
	Expanded    string `db:"expanded" json:"expanded"`
	Description string `db:"description" json:"description"`
}

type taxonomyEntry struct {
	ID          string `db:"id" json:"id"`
	PredicateID string `db:"predicate_id" json:"predicate_id"`
	Value       string `db:"value" json:"value"`
	Expanded    string `db:"expanded" json:"expanded"`
	Colour      string `db:"colour" json:"colour"`
	Description string `db:"description" json:"description"`
}

type taxonomyDetail struct {
	taxonomyRow
	Predicates []predicateWithEntries `json:"predicates"`
	TagCount   int                    `json:"tag_count"`
}

type predicateWithEntries struct {
	taxonomyPredicate
	Entries []taxonomyEntry `json:"entries"`
}

func (h *AdminCatalogHandler) ListTaxonomies(c echo.Context) error {
	rows := []taxonomyRow{}
	if err := h.db.SelectContext(c.Request().Context(), &rows, `
		SELECT id::text, namespace, description, version, enabled, source, created_by, created_at, updated_at
		FROM taxonomies ORDER BY namespace`); err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

func (h *AdminCatalogHandler) GetTaxonomy(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var tax taxonomyRow
	if err := h.db.GetContext(c.Request().Context(), &tax, `
		SELECT id::text, namespace, description, version, enabled, source, created_by, created_at, updated_at
		FROM taxonomies WHERE id = $1::uuid`, id); err == sql.ErrNoRows {
		return apierr.New(http.StatusNotFound, "taxonomy not found")
	} else if err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy detail failed")
	}
	preds := []taxonomyPredicate{}
	if err := h.db.SelectContext(c.Request().Context(), &preds, `
		SELECT id::text, taxonomy_id::text, value, expanded, description
		FROM taxonomy_predicates WHERE taxonomy_id = $1::uuid ORDER BY value`, id); err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy predicates failed")
	}
	entries := []taxonomyEntry{}
	if err := h.db.SelectContext(c.Request().Context(), &entries, `
		SELECT e.id::text, e.predicate_id::text, e.value, e.expanded, e.colour, e.description
		FROM taxonomy_entries e
		JOIN taxonomy_predicates p ON p.id = e.predicate_id
		WHERE p.taxonomy_id = $1::uuid ORDER BY e.value`, id); err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy entries failed")
	}
	byPred := map[string][]taxonomyEntry{}
	for _, e := range entries {
		byPred[e.PredicateID] = append(byPred[e.PredicateID], e)
	}
	out := taxonomyDetail{taxonomyRow: tax, TagCount: len(entries)}
	for _, p := range preds {
		out.Predicates = append(out.Predicates, predicateWithEntries{taxonomyPredicate: p, Entries: byPred[p.ID]})
	}
	return c.JSON(http.StatusOK, out)
}

// taxonomyImportRequest accepts the MISP-style JSON definition of a taxonomy.
// Reference: https://github.com/MISP/misp-taxonomies
type taxonomyImportRequest struct {
	Namespace   string `json:"namespace" validate:"required,min=1"`
	Description string `json:"description"`
	Version     int    `json:"version"`
	Predicates  []struct {
		Value       string `json:"value"`
		Expanded    string `json:"expanded"`
		Description string `json:"description"`
	} `json:"predicates"`
	Values []struct {
		Predicate string `json:"predicate"`
		Entry     []struct {
			Value       string `json:"value"`
			Expanded    string `json:"expanded"`
			Colour      string `json:"colour"`
			Description string `json:"description"`
		} `json:"entry"`
	} `json:"values"`
	Source string `json:"source"`
}

func (h *AdminCatalogHandler) ImportTaxonomy(c echo.Context) error {
	var req taxonomyImportRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if req.Source == "" {
		req.Source = "manual"
	}
	if req.Version == 0 {
		req.Version = 1
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy import failed")
	}
	defer func() { _ = tx.Rollback() }()
	var taxID string
	err = tx.GetContext(c.Request().Context(), &taxID, `
		INSERT INTO taxonomies (namespace, description, version, source, created_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (namespace) DO UPDATE SET
			description = EXCLUDED.description,
			version = EXCLUDED.version,
			source = EXCLUDED.source,
			updated_at = now()
		RETURNING id::text`,
		req.Namespace, req.Description, req.Version, req.Source, actorLogin(c))
	if err != nil {
		return apierr.New(http.StatusBadRequest, "taxonomy import failed: "+err.Error())
	}
	// Replace predicates (cascades to entries)
	if _, err := tx.ExecContext(c.Request().Context(),
		`DELETE FROM taxonomy_predicates WHERE taxonomy_id = $1::uuid`, taxID); err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy reset failed")
	}
	predIDByValue := map[string]string{}
	for _, p := range req.Predicates {
		var predID string
		if err := tx.GetContext(c.Request().Context(), &predID, `
			INSERT INTO taxonomy_predicates (taxonomy_id, value, expanded, description)
			VALUES ($1::uuid, $2, $3, $4) RETURNING id::text`,
			taxID, p.Value, p.Expanded, p.Description); err != nil {
			return apierr.New(http.StatusBadRequest, "taxonomy predicate failed: "+err.Error())
		}
		predIDByValue[p.Value] = predID
	}
	for _, vbucket := range req.Values {
		predID := predIDByValue[vbucket.Predicate]
		if predID == "" {
			continue
		}
		for _, e := range vbucket.Entry {
			if _, err := tx.ExecContext(c.Request().Context(), `
				INSERT INTO taxonomy_entries (predicate_id, value, expanded, colour, description)
				VALUES ($1::uuid, $2, $3, $4, $5)
				ON CONFLICT (predicate_id, value) DO UPDATE SET
					expanded = EXCLUDED.expanded,
					colour = EXCLUDED.colour,
					description = EXCLUDED.description`,
				predID, e.Value, e.Expanded, e.Colour, e.Description); err != nil {
				return apierr.New(http.StatusBadRequest, "taxonomy entry failed: "+err.Error())
			}
		}
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.taxonomy.import", "taxonomy", req.Namespace, nil, echo.Map{"namespace": req.Namespace, "version": req.Version}))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy import failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"id": taxID, "namespace": req.Namespace, "status": "imported"})
}

func (h *AdminCatalogHandler) ToggleTaxonomy(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&body); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid body")
	}
	res, err := h.db.ExecContext(c.Request().Context(),
		`UPDATE taxonomies SET enabled = $2, updated_at = now() WHERE id = $1::uuid`, id, body.Enabled)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy toggle failed")
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return apierr.New(http.StatusNotFound, "taxonomy not found")
	}
	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "admin.taxonomy.toggle", "taxonomy", id, nil, echo.Map{"enabled": body.Enabled}))
	}
	return c.JSON(http.StatusOK, echo.Map{"id": id, "enabled": body.Enabled})
}

func (h *AdminCatalogHandler) DeleteTaxonomy(c echo.Context) error {
	id := strings.TrimSpace(c.Param("id"))
	res, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM taxonomies WHERE id = $1::uuid`, id)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "taxonomy delete failed")
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return apierr.New(http.StatusNotFound, "taxonomy not found")
	}
	if h.audit != nil {
		_ = h.audit.Record(c.Request().Context(), audit.FromContext(c, "admin.taxonomy.delete", "taxonomy", id, map[string]string{"id": id}, nil))
	}
	return c.JSON(http.StatusOK, echo.Map{"id": id, "status": "deleted"})
}

// ---------- MITRE ATT&CK pattern catalogue ----------

type attackPatternRow struct {
	ID           string    `db:"id" json:"id"`
	PatternID    string    `db:"pattern_id" json:"pattern_id"`
	Name         string    `db:"name" json:"name"`
	Description  string    `db:"description" json:"description"`
	Tactic       string    `db:"tactic" json:"tactic"`
	KillChain    string    `db:"kill_chain" json:"kill_chain"`
	ReferenceURL string    `db:"reference_url" json:"reference_url"`
	Revoked      bool      `db:"revoked" json:"revoked"`
	Deprecated   bool      `db:"deprecated" json:"deprecated"`
	Source       string    `db:"source" json:"source"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

func (h *AdminCatalogHandler) ListAttackPatterns(c echo.Context) error {
	rows := []attackPatternRow{}
	tactic := strings.TrimSpace(c.QueryParam("tactic"))
	q := strings.TrimSpace(c.QueryParam("q"))
	args := []any{}
	where := []string{"1 = 1"}
	if tactic != "" {
		args = append(args, tactic)
		where = append(where, "tactic = $1")
	}
	if q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		where = append(where, "(lower(name) LIKE $"+intToStr(len(args))+" OR lower(pattern_id) LIKE $"+intToStr(len(args))+")")
	}
	query := `SELECT id::text, pattern_id, name, description, tactic, kill_chain, reference_url, revoked, deprecated, source, created_at, updated_at
		FROM attack_patterns WHERE ` + strings.Join(where, " AND ") + ` ORDER BY pattern_id LIMIT 1000`
	if err := h.db.SelectContext(c.Request().Context(), &rows, query, args...); err != nil {
		return apierr.New(http.StatusInternalServerError, "attack pattern list failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"values": rows, "total": len(rows)})
}

// attackImportRequest accepts a MITRE STIX 2.x bundle or simplified pattern array.
type attackImportRequest struct {
	Source   string `json:"source"`
	Patterns []struct {
		PatternID    string `json:"pattern_id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Tactic       string `json:"tactic"`
		KillChain    string `json:"kill_chain"`
		ReferenceURL string `json:"reference_url"`
		Revoked      bool   `json:"revoked"`
		Deprecated   bool   `json:"deprecated"`
	} `json:"patterns"`
	StixBundle json.RawMessage `json:"stix_bundle"`
}

func (h *AdminCatalogHandler) ImportAttackPatterns(c echo.Context) error {
	var req attackImportRequest
	if err := c.Bind(&req); err != nil {
		return apierr.New(http.StatusBadRequest, "invalid body")
	}
	if req.Source == "" {
		req.Source = "manual"
	}
	patterns := req.Patterns
	if len(patterns) == 0 && len(req.StixBundle) > 0 {
		patterns = parseStixBundle(req.StixBundle)
	}
	if len(patterns) == 0 {
		return apierr.New(http.StatusBadRequest, "no patterns to import")
	}
	tx, err := h.db.BeginTxx(c.Request().Context(), nil)
	if err != nil {
		return apierr.New(http.StatusInternalServerError, "attack import failed")
	}
	defer func() { _ = tx.Rollback() }()
	imported := 0
	for _, p := range patterns {
		if p.PatternID == "" || p.Name == "" {
			continue
		}
		if _, err := tx.ExecContext(c.Request().Context(), `
			INSERT INTO attack_patterns (pattern_id, name, description, tactic, kill_chain, reference_url, revoked, deprecated, source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (pattern_id) DO UPDATE SET
				name = EXCLUDED.name,
				description = EXCLUDED.description,
				tactic = EXCLUDED.tactic,
				kill_chain = EXCLUDED.kill_chain,
				reference_url = EXCLUDED.reference_url,
				revoked = EXCLUDED.revoked,
				deprecated = EXCLUDED.deprecated,
				source = EXCLUDED.source,
				updated_at = now()`,
			p.PatternID, p.Name, p.Description, p.Tactic, p.KillChain, p.ReferenceURL, p.Revoked, p.Deprecated, req.Source); err != nil {
			return apierr.New(http.StatusBadRequest, "attack pattern insert failed: "+err.Error())
		}
		imported++
	}
	if h.audit != nil {
		_ = audit.RecordTx(c.Request().Context(), tx, audit.FromContext(c, "admin.attack.import", "attack_patterns", req.Source, nil, echo.Map{"imported": imported, "source": req.Source}))
	}
	if err := tx.Commit(); err != nil {
		return apierr.New(http.StatusInternalServerError, "attack import failed")
	}
	return c.JSON(http.StatusOK, echo.Map{"imported": imported, "source": req.Source})
}

// parseStixBundle extracts MITRE attack-pattern objects from a STIX 2.x bundle.
// We only support the strict subset emitted by the official MITRE bundles to
// keep parser surface small and predictable.
func parseStixBundle(bundle []byte) []struct {
	PatternID    string `json:"pattern_id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Tactic       string `json:"tactic"`
	KillChain    string `json:"kill_chain"`
	ReferenceURL string `json:"reference_url"`
	Revoked      bool   `json:"revoked"`
	Deprecated   bool   `json:"deprecated"`
} {
	type stixObject struct {
		Type         string `json:"type"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Revoked      bool   `json:"revoked"`
		XDeprecated  bool   `json:"x_mitre_deprecated"`
		ExternalRefs []struct {
			SourceName string `json:"source_name"`
			ExternalID string `json:"external_id"`
			URL        string `json:"url"`
		} `json:"external_references"`
		KillChainPhases []struct {
			KillChainName string `json:"kill_chain_name"`
			PhaseName     string `json:"phase_name"`
		} `json:"kill_chain_phases"`
	}
	var parsed struct {
		Objects []stixObject `json:"objects"`
	}
	if err := json.Unmarshal(bundle, &parsed); err != nil {
		return nil
	}
	out := []struct {
		PatternID    string `json:"pattern_id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Tactic       string `json:"tactic"`
		KillChain    string `json:"kill_chain"`
		ReferenceURL string `json:"reference_url"`
		Revoked      bool   `json:"revoked"`
		Deprecated   bool   `json:"deprecated"`
	}{}
	for _, obj := range parsed.Objects {
		if obj.Type != "attack-pattern" {
			continue
		}
		patternID := ""
		referenceURL := ""
		for _, ref := range obj.ExternalRefs {
			if ref.SourceName == "mitre-attack" {
				patternID = ref.ExternalID
				referenceURL = ref.URL
				break
			}
		}
		if patternID == "" {
			continue
		}
		killChain := ""
		tactic := ""
		if len(obj.KillChainPhases) > 0 {
			killChain = obj.KillChainPhases[0].KillChainName
			tactic = obj.KillChainPhases[0].PhaseName
		}
		out = append(out, struct {
			PatternID    string `json:"pattern_id"`
			Name         string `json:"name"`
			Description  string `json:"description"`
			Tactic       string `json:"tactic"`
			KillChain    string `json:"kill_chain"`
			ReferenceURL string `json:"reference_url"`
			Revoked      bool   `json:"revoked"`
			Deprecated   bool   `json:"deprecated"`
		}{
			PatternID: patternID, Name: obj.Name, Description: obj.Description,
			Tactic: tactic, KillChain: killChain, ReferenceURL: referenceURL,
			Revoked: obj.Revoked, Deprecated: obj.XDeprecated,
		})
	}
	return out
}

// intToStr is a tiny helper used to build positional parameter placeholders
// like $2, $3 when we accumulate filter args dynamically. We avoid strconv
// to stay consistent with the lightweight style used elsewhere in this
// package and to avoid clashing with another in-package itoa helper.
func intToStr(i int) string {
	const digits = "0123456789"
	if i == 0 {
		return "0"
	}
	out := []byte{}
	for i > 0 {
		out = append([]byte{digits[i%10]}, out...)
		i /= 10
	}
	return string(out)
}
