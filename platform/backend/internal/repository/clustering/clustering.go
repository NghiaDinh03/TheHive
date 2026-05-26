package clustering

import (
	"context"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type ClusterRecord struct {
	ID              string    `db:"id" json:"id"`
	CaseID          string    `db:"case_id" json:"case_id"`
	AlertID         string    `db:"alert_id" json:"alert_id"`
	SimilarityScore float64   `db:"similarity_score" json:"similarity_score"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

type EntityFeatures struct {
	ID          string
	Title       string
	Description string
	Tags        []string
	Observables []string // array of "data_type:data"
}

// Tokenize text into unique words for text Jaccard similarity
func Tokenize(text string) map[string]bool {
	tokens := make(map[string]bool)
	re := regexp.MustCompile(`[a-zA-Z0-9]+`)
	words := re.FindAllString(strings.ToLower(text), -1)
	for _, word := range words {
		if len(word) > 2 { // ignore extremely short words
			tokens[word] = true
		}
	}
	return tokens
}

// Calculate Jaccard similarity between two token sets
func JaccardSimilarity(setA, setB map[string]bool) float64 {
	if len(setA) == 0 && len(setB) == 0 {
		return 1.0
	}
	if len(setA) == 0 || len(setB) == 0 {
		return 0.0
	}

	intersection := 0
	for token := range setA {
		if setB[token] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	return float64(intersection) / float64(union)
}

// Convert slice to map set
func SliceToSet(slice []string) map[string]bool {
	set := make(map[string]bool)
	for _, item := range slice {
		cleaned := strings.TrimSpace(strings.ToLower(item))
		if cleaned != "" {
			set[cleaned] = true
		}
	}
	return set
}

// Calculate weighted similarity score between Alert and Case features
func CalculateSimilarity(alert, kase EntityFeatures) float64 {
	// 1. Text Similarity (Title + Description)
	alertText := alert.Title + " " + alert.Description
	caseText := kase.Title + " " + kase.Description
	textSim := JaccardSimilarity(Tokenize(alertText), Tokenize(caseText))

	// 2. Tags Similarity
	tagsSim := JaccardSimilarity(SliceToSet(alert.Tags), SliceToSet(kase.Tags))

	// 3. Observables Similarity
	obsSim := JaccardSimilarity(SliceToSet(alert.Observables), SliceToSet(kase.Observables))

	// Weighted Average
	// Observables: 0.5 (strong signal), Text: 0.3, Tags: 0.2
	var score float64

	// If neither has observables, we don't penalize. Redraw weights.
	if len(alert.Observables) == 0 && len(kase.Observables) == 0 {
		score = (textSim * 0.6) + (tagsSim * 0.4)
	} else {
		score = (obsSim * 0.5) + (textSim * 0.3) + (tagsSim * 0.2)
	}

	// Round to 4 decimal places
	return math.Round(score*10000) / 10000
}

// Fetch active cases within time window
func (r *Repository) GetActiveCasesFeatures(ctx context.Context, tx *sqlx.Tx, timeWindow time.Duration) ([]EntityFeatures, error) {
	cutoff := time.Now().Add(-timeWindow)
	query := `
		SELECT c.id::text AS id, c.title, c.description, c.tags,
			COALESCE(array_agg(o.data_type || ':' || o.data) FILTER (WHERE o.id IS NOT NULL), '{}') AS observables
		FROM cases c
		LEFT JOIN observables o ON o.case_id = c.id
		WHERE c.status NOT IN ('Resolved', 'Closed')
		  AND c.updated_at >= $1
		GROUP BY c.id, c.title, c.description, c.tags
	`
	type DBRow struct {
		ID          string         `db:"id"`
		Title       string         `db:"title"`
		Description string         `db:"description"`
		Tags        pq.StringArray `db:"tags"`
		Observables pq.StringArray `db:"observables"`
	}

	var rows []DBRow
	var err error
	if tx != nil {
		err = tx.SelectContext(ctx, &rows, query, cutoff)
	} else {
		err = r.db.SelectContext(ctx, &rows, query, cutoff)
	}
	if err != nil {
		return nil, err
	}

	features := make([]EntityFeatures, len(rows))
	for i, r := range rows {
		features[i] = EntityFeatures{
			ID:          r.ID,
			Title:       r.Title,
			Description: r.Description,
			Tags:        []string(r.Tags),
			Observables: []string(r.Observables),
		}
	}
	return features, nil
}

// Fetch single alert features
func (r *Repository) GetAlertFeatures(ctx context.Context, tx *sqlx.Tx, alertID string) (EntityFeatures, error) {
	query := `
		SELECT a.id::text AS id, a.title, a.description, a.tags,
			COALESCE(array_agg(o.data_type || ':' || o.data) FILTER (WHERE o.id IS NOT NULL), '{}') AS observables
		FROM alerts a
		LEFT JOIN observables o ON o.alert_id = a.id
		WHERE a.id = $1::uuid
		GROUP BY a.id, a.title, a.description, a.tags
	`
	type DBRow struct {
		ID          string         `db:"id"`
		Title       string         `db:"title"`
		Description string         `db:"description"`
		Tags        pq.StringArray `db:"tags"`
		Observables pq.StringArray `db:"observables"`
	}

	var row DBRow
	var err error
	if tx != nil {
		err = tx.GetContext(ctx, &row, query, alertID)
	} else {
		err = r.db.GetContext(ctx, &row, query, alertID)
	}
	if err != nil {
		return EntityFeatures{}, err
	}

	return EntityFeatures{
		ID:          row.ID,
		Title:       row.Title,
		Description: row.Description,
		Tags:        []string(row.Tags),
		Observables: []string(row.Observables),
	}, nil
}

// Save alert cluster record
func (r *Repository) SaveCluster(ctx context.Context, tx *sqlx.Tx, caseID, alertID string, score float64) error {
	query := `
		INSERT INTO alert_clusters (case_id, alert_id, similarity_score)
		VALUES ($1::uuid, $2::uuid, $3)
		ON CONFLICT (case_id, alert_id) DO UPDATE SET similarity_score = EXCLUDED.similarity_score
	`
	var err error
	if tx != nil {
		_, err = tx.ExecContext(ctx, query, caseID, alertID, score)
	} else {
		_, err = r.db.ExecContext(ctx, query, caseID, alertID, score)
	}
	return err
}

// Find best matching active case for an alert
func (r *Repository) EvaluateClustering(ctx context.Context, tx *sqlx.Tx, alertID string) (string, float64, error) {
	alertFeat, err := r.GetAlertFeatures(ctx, tx, alertID)
	if err != nil {
		return "", 0, err
	}

	// Time window is 24 hours
	cases, err := r.GetActiveCasesFeatures(ctx, tx, 24*time.Hour)
	if err != nil {
		return "", 0, err
	}

	var bestCaseID string
	var maxScore float64

	for _, c := range cases {
		score := CalculateSimilarity(alertFeat, c)
		if score > maxScore {
			maxScore = score
			bestCaseID = c.ID
		}
	}

	return bestCaseID, maxScore, nil
}

// Fetch all clustered alerts for a case
type ClusteredAlertInfo struct {
	AlertID         string    `db:"alert_id" json:"alert_id"`
	Title           string    `db:"title" json:"title"`
	Source          string    `db:"source" json:"source"`
	Severity        int       `db:"severity" json:"severity"`
	SimilarityScore float64   `db:"similarity_score" json:"similarity_score"`
	ClusteredAt     time.Time `db:"created_at" json:"clustered_at"`
}

func (r *Repository) GetClusteredAlerts(ctx context.Context, caseID string) ([]ClusteredAlertInfo, error) {
	var list []ClusteredAlertInfo
	err := r.db.SelectContext(ctx, &list, `
		SELECT ac.alert_id::text AS alert_id, a.title, a.source, a.severity, ac.similarity_score, ac.created_at
		FROM alert_clusters ac
		JOIN alerts a ON a.id = ac.alert_id
		WHERE ac.case_id = $1::uuid
		ORDER BY ac.similarity_score DESC, ac.created_at DESC
	`, caseID)
	return list, err
}
