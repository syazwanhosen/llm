# Deploy free on Hugging Face Spaces (Docker, CPU)

A [Hugging Face **Docker Space**](https://huggingface.co/docs/hub/spaces-sdks-docker) runs this
app **100% free** on CPU and gives you a public URL — no VM, no credit card, no API keys.
Everything (the web app + Ollama + the models) runs inside **one** container.

**Honest caveats (free CPU tier — 2 vCPU, 16 GB RAM):**
- **Slow:** generation on 2 vCPUs is slow, so the image defaults to a small chat model
  (`llama3.2:1b`) to stay usable. Switch to `llama3.1` in the Dockerfile for better answers.
- **Sleeps:** free Spaces pause after ~48 h idle and cold-start on the next visit.
- **Ephemeral storage:** uploaded PDFs / the vector store reset when the Space restarts or
  rebuilds (persistent storage is a paid add-on).

You provide a free Hugging Face account; the two files in
[`deploy/huggingface/`](deploy/huggingface) do the rest.

## 1. Create the Space
- Go to <https://huggingface.co/new-space>.
- **SDK → Docker**, template **Blank**, **Hardware → CPU basic (free)**. Create it.

## 2. Add the two files
A Space is just a git repo. It needs exactly two files — copy them from this repo's
[`deploy/huggingface/`](deploy/huggingface):

- **`Dockerfile`** — clones the app, installs Node + Ollama, and **bakes the models in** so the
  Space boots without downloading them each time.
- **`README.md`** — the Space "card"; its front-matter (`sdk: docker`, `app_port: 7860`) tells HF
  how to run the container.

**Easiest (website):** open the Space → **Files** → **Add file → Create new file** → name it
`Dockerfile`, paste the contents, commit. Then edit the Space's `README.md` and paste the card.

**Or via git:**
```bash
git clone https://huggingface.co/spaces/<your-username>/<your-space>
cd <your-space>
cp /path/to/llm/deploy/huggingface/Dockerfile .
cp /path/to/llm/deploy/huggingface/README.md .
git add Dockerfile README.md && git commit -m "Chat with your PDF" && git push
```
(Pushing prompts for your HF username + an access token from
<https://huggingface.co/settings/tokens>.)

## 3. Build, then use it
HF builds the image automatically (a few minutes — it installs Node and downloads the models
once). When the Space flips to **Running**, open its URL and drag in PDFs. The **first** answer
after a cold start is slow while the model loads into RAM; later answers are quicker.

## Customise
- **Quality vs. speed:** in the `Dockerfile`, change `CHAT_MODEL=llama3.2:1b` to `llama3.2:3b`
  (a middle ground) or `llama3.1` (best quality, slowest on CPU).
- **Update the app:** the Dockerfile clones `main`, so to pick up new commits use
  **Settings → Factory rebuild**.

> Note: this Dockerfile is tailored to the Space's single-container, run-as-UID-1000, port-7860
> model — it's separate from the repo's `docker-compose.yml`, which targets a VM/VPS.
