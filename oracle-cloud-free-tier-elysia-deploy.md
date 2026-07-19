# Desplegar Dominó Occidental (Bun + Elysia) en Oracle Cloud Free Tier

Guía completa: desde crear la cuenta hasta tener el backend corriendo 24/7 con WebSocket, Nginx como proxy inverso y HTTPS.

---

## 1. Crear la cuenta y la VM

### 1.1 Registro
1. Andá a https://www.oracle.com/cloud/free/ y creá una cuenta.
2. Necesitás una tarjeta de crédito para verificación (no te cobran nada si te quedás en el tier "Always Free").
3. Elegí una región. **Importante**: una vez elegida, no se puede cambiar fácilmente y la disponibilidad de VMs ARM (Ampere) varía por región — si una región está "agotada", probá con otra al crear la cuenta.

### 1.2 Crear la instancia (VM.Standard.A1.Flex - ARM)
1. En el dashboard: **Menú ☰ → Compute → Instances → Create Instance**.
2. Nombre: `domino-backend`.
3. **Image and shape**:
   - Imagen: Ubuntu 24.04 (o la LTS más reciente disponible).
   - Shape: cambiá a **Ampere (ARM)** → `VM.Standard.A1.Flex`.
   - Asigná hasta 4 OCPUs y 24 GB RAM (el máximo del Always Free tier). Con 2 OCPU / 12GB sobra para tu backend + Postgres local si lo necesitaras.
4. **Networking**: dejá que cree una VCN nueva. Asegurate de que "Assign a public IPv4 address" esté marcado.
5. **Add SSH keys**: generá un par de claves o subí tu clave pública existente. Guardá la clave privada, la vas a necesitar para conectarte.
6. Click **Create**. Tarda 1-2 minutos en aprovisionar.

> **Nota sobre disponibilidad**: Oracle a veces devuelve "Out of host capacity" para shapes ARM gratis. Si pasa, esperá y reintentá en otro momento, o cambiá de región. Es un problema conocido y temporal, no un error tuyo.

---

## 2. Abrir los puertos necesarios

Por defecto Oracle bloquea casi todo el tráfico entrante. Necesitás abrir puertos en **dos capas**: el Security List de la VCN y el firewall interno de Ubuntu (`iptables`/`netfilter`, que en las imágenes de Oracle viene con reglas restrictivas).

### 2.1 Security List (nivel de red, en la consola de Oracle)
1. **Menú ☰ → Networking → Virtual Cloud Networks** → entrá a tu VCN → **Security Lists** → la lista por defecto.
2. **Add Ingress Rules**:
   - Puerto 80 (HTTP), fuente `0.0.0.0/0`
   - Puerto 443 (HTTPS), fuente `0.0.0.0/0`
   - Puerto 22 (SSH) ya debería estar abierto por defecto

### 2.2 Firewall interno de Ubuntu
Conectate por SSH (ver paso 3) y corré:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Si tu imagen usa `ufw` en vez de `iptables` directo:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 3. Conectarte por SSH

```bash
chmod 600 ruta/a/tu-clave-privada.key
ssh -i ruta/a/tu-clave-privada.key ubuntu@<IP_PUBLICA_DE_LA_VM>
```

La IP pública la ves en el detalle de la instancia en la consola de Oracle.

---

## 4. Preparar el servidor

```bash
sudo apt update && sudo apt upgrade -y

# Instalar Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version   # confirmar instalación

# Instalar Nginx
sudo apt install -y nginx

# Instalar Git
sudo apt install -y git
```

---

## 5. Clonar y preparar tu proyecto

```bash
cd ~
git clone <url-de-tu-repo> domino-occidental
cd domino-occidental

# IMPORTANTE: install desde la raíz del monorepo (resuelve @domino/shared)
bun install
```

Creá el archivo `.env` en `packages/backend/` con tus variables:

```bash
nano packages/backend/.env
```

```env
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
SUPABASE_JWT_SECRET=<tu JWT secret>
PORT=3001
```

Probá que arranque manualmente:

```bash
cd packages/backend
bun run start
```

Si responde bien, `Ctrl+C` y seguimos para dejarlo corriendo como servicio.

---

## 6. Servicio systemd (para que corra siempre, incluso si la VM reinicia)

```bash
sudo nano /etc/systemd/system/domino-backend.service
```

```ini
[Unit]
Description=Dominó Occidental - Elysia Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/domino-occidental/packages/backend
ExecStart=/home/ubuntu/.bun/bin/bun run start
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/domino-occidental/packages/backend/.env

[Install]
WantedBy=multi-user.target
```

Activarlo:

```bash
sudo systemctl daemon-reload
sudo systemctl enable domino-backend
sudo systemctl start domino-backend
sudo systemctl status domino-backend
```

Ver logs en vivo:

```bash
journalctl -u domino-backend -f
```

---

## 7. Nginx como proxy inverso (con soporte WebSocket)

Esto es la parte más delicada: Nginx necesita las cabeceras `Upgrade` y `Connection` para no cortar la conexión WS.

```bash
sudo nano /etc/nginx/sites-available/domino-backend
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # o la IP pública si aún no tenés dominio

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # Soporte WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts largos para conexiones WS persistentes
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Activar el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/domino-backend /etc/nginx/sites-enabled/
sudo nginx -t   # valida la config
sudo systemctl restart nginx
```

---

## 8. Dominio (opcional pero recomendado)

1. Comprá un dominio (Namecheap, Porkbun, etc. — no hace falta que sea caro).
2. En el DNS del dominio, creá un registro **A** apuntando a la IP pública de tu VM Oracle.
3. Esperá la propagación (5 min a unas horas).

Si no querés dominio todavía, podés usar directamente la IP pública en la config de Nginx y en `NEXT_PUBLIC_WS_URL` — pero **no vas a poder tener HTTPS/WSS sin dominio**, porque Let's Encrypt no emite certificados para IPs.

---

## 9. HTTPS con Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

Certbot va a:
- Modificar tu config de Nginx para servir por 443 con el certificado.
- Configurar la renovación automática (se renueva solo cada ~60 días).

Verificá la renovación automática:

```bash
sudo certbot renew --dry-run
```

Con esto ya tenés `wss://tu-dominio.com` funcionando para las conexiones WebSocket.

---

## 10. Conectar con Vercel (frontend)

En las variables de entorno de Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PhdEuZxhWb22GjWY.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu anon key>
BACKEND_URL=https://tu-dominio.com
NEXT_PUBLIC_WS_URL=wss://tu-dominio.com
```

---

## 11. Google OAuth

En Google Cloud Console y en Supabase Dashboard, agregá el dominio de **Vercel** (el frontend) como antes — el backend en Oracle no participa en el flujo OAuth, así que no cambia nada de esa parte.

---

## 12. Checklist de verificación final

- [ ] `systemctl status domino-backend` → `active (running)`
- [ ] `curl http://localhost:3001/health` desde la VM responde OK
- [ ] `curl https://tu-dominio.com/health` desde tu máquina local responde OK
- [ ] Conexión WS de prueba desde el navegador no se corta
- [ ] Reiniciar la VM (`sudo reboot`) y confirmar que el backend vuelve solo (gracias a systemd)
- [ ] 4 navegadores jugando una partida completa sin desconexiones

---

## 13. Actualizar después de un push

Cuando hagas `git push` desde tu máquina local, en la VM corré:

```bash
cd ~/domino-occidental
git pull

# Reinstall por si cambió algo en shared o package.json
bun install

# Reiniciar el servicio
sudo systemctl restart domino-backend

# Verificar que volvió bien
sudo systemctl status domino-backend
curl http://localhost:3001/health
```

Si querés automatizar esto, podés crear un script `deploy.sh` en la raíz del repo:

```bash
#!/bin/bash
set -e
cd ~/domino-occidental
git pull
bun install
sudo systemctl restart domino-backend
echo "✅ Deployed. Backend restarted."
```

Y ejecutarlo con `bash deploy.sh` después de cada push.

---

## 14. Mantenimiento que queda de tu lado (el trade-off de "gratis")

A diferencia de un PaaS, ahora sos vos quien:
- Aplica actualizaciones de seguridad: `sudo apt update && sudo apt upgrade -y` (podés automatizarlo con `unattended-upgrades`)
- Monitorea que el proceso no se caiga (systemd ya reinicia solo, pero conviene revisar logs de vez en cuando)
- Gestiona la renovación de certificados (Certbot ya lo automatiza)
- Hace backups de configuración de la VM si algo se rompe

Si en algún momento el mantenimiento te empieza a quitar más tiempo del que vale el ahorro de $5/mes, migrar a Railway Hobby es tan simple como apuntar las variables de entorno — tu código no cambia en nada.
