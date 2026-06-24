package hosted

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"text/template"

	"github.com/google/uuid"
)

// Provisioner creates and manages k8s resources for tenant lattice instances
// by calling kubectl directly. This avoids the heavy client-go dependency
// and works with any k8s version.
type Provisioner struct {
	namespace     string // namespace where tenant deployments live
	image         string // Docker image for tenant lattice instances
	clusterIssuer string // cert-manager cluster issuer for TLS
}

// NewProvisioner creates a new k8s provisioner.
func NewProvisioner(namespace, image, clusterIssuer string) *Provisioner {
	return &Provisioner{
		namespace:     namespace,
		image:          image,
		clusterIssuer:  clusterIssuer,
	}
}

// EnsureNamespace creates the namespace if it doesn't exist.
// This is a best-effort check — the namespace should already exist (created
// by the k8s manifest). If the ServiceAccount lacks cluster-level RBAC,
// the error is logged but not returned as fatal.
func (p *Provisioner) EnsureNamespace(ctx context.Context) error {
	_, err := kubectl(ctx, "get", "namespace", p.namespace)
	if err == nil {
		return nil // already exists
	}

	// Try to create it, but don't fail if we lack permissions —
	// the namespace is typically created by the deployment manifest.
	_, err = kubectl(ctx, "create", "namespace", p.namespace)
	if err != nil {
		// Non-fatal: namespace likely already exists but we can't see it
		// due to namespace-scoped RBAC.
		return nil
	}
	log.Printf("Created namespace %s", p.namespace)
	return nil
}

// Provision creates all k8s resources for a new tenant.
func (p *Provisioner) Provision(ctx context.Context, t Tenant) error {
	name := tenantK8sName(t.Slug)

	// Render the full manifest
	manifest, err := p.renderManifest(name, t)
	if err != nil {
		return fmt.Errorf("failed to render manifest: %w", err)
	}

	// Apply all resources at once
	if _, err := kubectlWithStdin(ctx, manifest, "apply", "-f", "-"); err != nil {
		return fmt.Errorf("failed to apply manifest for %s: %w", t.Slug, err)
	}

	log.Printf("Provisioned tenant %s at %s.lattice.black", t.Slug, t.Slug)
	return nil
}

// Deprovision removes all k8s resources for a tenant.
func (p *Provisioner) Deprovision(ctx context.Context, slug string) error {
	name := tenantK8sName(slug)

	_, err := kubectl(ctx, "delete", "-n", p.namespace,
		"deployment,service,ingress,pvc,secret",
		"-l", "app="+name,
	)
	if err != nil && !strings.Contains(err.Error(), "not found") && !strings.Contains(err.Error(), "no resources found") {
		return fmt.Errorf("failed to deprovision %s: %w", slug, err)
	}

	log.Printf("Deprovisioned tenant %s", slug)
	return nil
}

// Scale scales a tenant's deployment to the given replica count.
func (p *Provisioner) Scale(ctx context.Context, slug string, replicas int) error {
	name := tenantK8sName(slug)
	_, err := kubectl(ctx, "scale", "-n", p.namespace, "deployment", name, "--replicas="+fmt.Sprint(replicas))
	if err != nil {
		return fmt.Errorf("failed to scale %s to %d: %w", slug, replicas, err)
	}
	log.Printf("Scaled tenant %s to %d replicas", slug, replicas)
	return nil
}

// renderManifest renders the full k8s manifest for a tenant using the template.
func (p *Provisioner) renderManifest(name string, t Tenant) (string, error) {
	data := manifestData{
		Name:          name,
		Namespace:     p.namespace,
		Slug:          t.Slug,
		Image:         p.image,
		APIKey:        t.APIKey,
		Host:          t.Slug + ".lattice.black",
		ClusterIssuer: p.clusterIssuer,
	}

	var buf bytes.Buffer
	if err := tenantManifestTmpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

type manifestData struct {
	Name          string
	Namespace     string
	Slug          string
	Image         string
	APIKey        string
	Host          string
	ClusterIssuer string
}

const tenantManifestTmplStr = `---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
  labels:
    app: {{.Name}}
    managed: lattice-hosted
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 100Mi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
  labels:
    app: {{.Name}}
    managed: lattice-hosted
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{.Name}}
  template:
    metadata:
      labels:
        app: {{.Name}}
        managed: lattice-hosted
    spec:
      imagePullSecrets:
      - name: ghcr-lattice-pull-secret
      containers:
      - name: lattice
        image: {{.Image}}
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        env:
        - name: LATTICE_API_KEY
          value: {{.APIKey}}
        - name: LATTICE_DB_PATH
          value: /data/lattice.db
        volumeMounts:
        - name: data
          mountPath: /data
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        resources:
          requests:
            cpu: 25m
            memory: 32Mi
          limits:
            cpu: 200m
            memory: 128Mi
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: {{.Name}}
---
apiVersion: v1
kind: Service
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
  labels:
    app: {{.Name}}
    managed: lattice-hosted
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: {{.Name}}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{.Name}}
  namespace: {{.Namespace}}
  labels:
    app: {{.Name}}
    managed: lattice-hosted
  annotations:
    cert-manager.io/cluster-issuer: {{.ClusterIssuer}}
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  ingressClassName: traefik
  tls:
  - hosts:
    - {{.Host}}
    secretName: {{.Name}}-tls
  rules:
  - host: {{.Host}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{.Name}}
            port:
              number: 80
`

var tenantManifestTmpl = template.Must(template.New("tenant").Parse(tenantManifestTmplStr))

func tenantK8sName(slug string) string {
	return "lattice-" + slug
}

func generateTenantID() string {
	return "tnt_" + uuid.New().String()[:12]
}

func generateAPIKey() string {
	return "lat_" + uuid.New().String()
}

func kubectl(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "kubectl", args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func kubectlWithStdin(ctx context.Context, stdin string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "kubectl", args...)
	cmd.Stdin = strings.NewReader(stdin)
	output, err := cmd.CombinedOutput()
	return string(output), err
}