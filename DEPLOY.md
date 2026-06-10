# Deploying for free (self-hosted, no API keys)

This app runs an 8B model locally via **Ollama**, which needs ~6–8 GB RAM — more than
any "free tier" PaaS (Render/Railway/Vercel/Fly free) gives you. The one platform that is
**100 % free *and* big enough** is **Oracle Cloud "Always Free"**: an Arm (Ampere A1) VM
with up to **4 cores and 24 GB RAM, free forever**, with a persistent disk so your uploaded
PDFs and vector store survive restarts.

> It's CPU-only, so answers generate slower than on a GPU — fine for a demo/portfolio,
> not for heavy traffic. If you'd rather trade "fully local" for speed, see
> [Alternatives](#alternatives) at the bottom.

Everything here is automated by the included `Dockerfile` and `docker-compose.yml`.
You provide the free VM; deployment is then `git clone` → `docker compose up`.

---

## 1. Create the free VM (Oracle Cloud)

1. Sign up at <https://www.oracle.com/cloud/free/> (a card is used for identity verification;
   the Always Free resources are never charged).
2. **Compute → Instances → Create instance:**
   - **Image:** Canonical **Ubuntu 22.04**.
   - **Shape:** change to **Ampere (Arm) → `VM.Standard.A1.Flex`**, set **4 OCPUs / 24 GB**
     (all within Always Free).
   - **SSH keys:** upload your public key (or let it generate one and download it).
   - Create.
3. Note the instance's **public IP**.

> **Tip:** A1 capacity is popular and sometimes shows "out of capacity." Try a different
> Availability Domain or region, or retry later. (3 OCPU / 18 GB also works if 4/24 is full.)

## 2. Open the ports

Two layers of firewall must allow inbound HTTP:

- **Oracle:** Networking → your VCN → Security List → **Add Ingress Rule**: source `0.0.0.0/0`,
  TCP, destination port **80** (and **443** if you'll add HTTPS).
- **On the VM** (Ubuntu's iptables blocks by default):
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```

## 3. Install Docker

```bash
ssh ubuntu@<your-public-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker     # run docker without sudo
```

## 4. Deploy

```bash
git clone https://github.com/syazwanhosen/llm.git
cd llm
docker compose up -d --build
```

The first run builds the app image and **pulls ~5 GB of models** (`llama3.1` +
`nomic-embed-text`) — give it several minutes. Watch progress with:

```bash
docker compose logs -f ollama-pull     # model download
docker compose logs -f app             # "web UI on http://localhost:3000" when ready
```

## 5. Use it

Open **`http://<your-public-ip>`** in a browser — drag in PDFs and chat. Uploaded data is
persisted on the VM under `./data`, so it survives `docker compose restart` and reboots.

---

## Add free HTTPS + a password (optional, recommended before sharing)

Plain `http://<ip>` is open to anyone. To get free HTTPS **and** a password, point a free
hostname at the VM and put **Caddy** in front:

1. Create a free subdomain at <https://www.duckdns.org> and set it to your VM's public IP.
2. Edit `Caddyfile` — replace `your-subdomain.duckdns.org` with it, and (recommended)
   uncomment `basic_auth` after generating a hash:
   ```bash
   docker run --rm caddy caddy hash-password --plaintext 'your-password'
   ```
3. In `docker-compose.yml`, **remove the `ports:` block from the `app` service** (Caddy will
   be the only thing exposed) and add this service:
   ```yaml
     caddy:
       image: caddy:2
       restart: unless-stopped
       depends_on: [app]
       ports: ["80:80", "443:443"]
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile
         - caddy_data:/data
         - caddy_config:/config
   ```
   …and add `caddy_data:` and `caddy_config:` under the top-level `volumes:` key.
4. `docker compose up -d`. Visit `https://your-subdomain.duckdns.org` — Caddy auto-provisions
   a Let's Encrypt certificate. (Caddy streams the chat's SSE responses correctly out of the box.)

---

## Maintenance

| Task | Command |
| --- | --- |
| View logs | `docker compose logs -f app` |
| Update after a `git pull` | `docker compose up -d --build` |
| Stop / start | `docker compose down` / `docker compose up -d` |
| Reset all indexed PDFs | delete `./data/vector-store.json` (or use **Clear all** in the UI) |

**Notes**
- **Speed:** CPU inference on the A1 is usable but not fast. A smaller chat model (e.g.
  `CHAT_MODEL=llama3.2:1b` in `docker-compose.yml`) responds much quicker if you want snappier demos.
- **Persistence:** the vector store is the JSON file in `./data`. Keep that directory and your
  uploads (and chat index) persist. For a larger corpus, migrate to Chroma/PGVector later.
- **Single instance:** the store is in-memory per process — don't run more than one `app` replica.

---

## Alternatives

- **No VM, instant URL — Hugging Face Spaces (Docker, free):** 2 vCPU / 16 GB RAM, free, gives a
  public URL. Caveats: it sleeps when idle and storage is ephemeral (uploads reset on rebuild),
  so it's better for a quick public demo than durable use.
- **Don't need it fully local — free hosted model API:** keep the app on a tiny free host and
  swap `src/models.ts` to a free LLM tier (e.g. **Groq** for Llama, **Google Gemini** for
  embeddings). Fast and free within rate limits, but your data leaves the box.
- **Just show it today — a tunnel:** run `npm run web` on your own machine and expose it with
  `cloudflared tunnel --url http://localhost:3000` (free). Up only while your machine is on.
