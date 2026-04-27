package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

type Registry struct {
	Reg *prometheus.Registry

	HTTPRequests       *prometheus.CounterVec
	HTTPRequestLatency *prometheus.HistogramVec
	DBQueryLatency     *prometheus.HistogramVec
	MQPublish          *prometheus.CounterVec
	MQConsume          *prometheus.CounterVec
	AppInfo            *prometheus.GaugeVec
}

func New() *Registry {
	reg := prometheus.NewRegistry()
	reg.MustRegister(collectors.NewGoCollector())
	reg.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

	r := &Registry{Reg: reg}

	r.HTTPRequests = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests processed.",
	}, []string{"method", "path", "status"})

	r.HTTPRequestLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency.",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})

	r.DBQueryLatency = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "db_query_duration_seconds",
		Help:    "Database query latency.",
		Buckets: prometheus.DefBuckets,
	}, []string{"query"})

	r.MQPublish = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "mq_publish_total",
		Help: "Total MQ publish operations.",
	}, []string{"exchange", "routing_key", "status"})

	r.MQConsume = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "mq_consume_total",
		Help: "Total MQ consume operations.",
	}, []string{"queue", "status"})

	r.AppInfo = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "app_info",
		Help: "Application info.",
	}, []string{"version", "git_sha", "release_class"})

	reg.MustRegister(
		r.HTTPRequests,
		r.HTTPRequestLatency,
		r.DBQueryLatency,
		r.MQPublish,
		r.MQConsume,
		r.AppInfo,
	)
	return r
}

func (r *Registry) Handler() http.Handler {
	return promhttp.HandlerFor(r.Reg, promhttp.HandlerOpts{Registry: r.Reg})
}
