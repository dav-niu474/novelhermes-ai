---
Task ID: 1
Agent: Main
Task: Replace z-ai-web-dev-sdk with NVIDIA NIM API, push to GitHub, deploy to Vercel

Work Log:
- Created src/lib/nvidia-ai.ts - NVIDIA NIM API client using OpenAI-compatible endpoint (https://integrate.api.nvidia.com/v1)
- Updated src/lib/ai.ts - Replaced all z-ai-web-dev-sdk calls with NVIDIA chat() function
- Updated src/app/api/ai/hermes/route.ts - Replaced z-ai-web-dev-sdk with NVIDIA API for Hermes chat and chapter draft generation
- Added NVIDIA_API_KEY to .env file
- Added postinstall script for Prisma client generation on Vercel
- Updated src/lib/db.ts - Added Vercel cold-start DB initialization and reduced logging in production
- Configured Vercel environment variables: NVIDIA_API_KEY, DATABASE_URL (file:/tmp/novelhermes.db)
- Pushed code to GitHub: https://github.com/dav-niu474/novelhermes-ai.git
- Deployed to Vercel: https://novelhermes-ai.vercel.app
- Used primary model: qwen/qwen2.5-72b-instruct with fallback models: meta/llama-3.3-70b-instruct, nvidia/llama-3.1-nemotron-70b-instruct

Stage Summary:
- All AI functionality now uses NVIDIA NIM API instead of z-ai-web-dev-sdk
- Application builds and runs successfully locally
- Vercel deployment successful with proper environment variables
- GitHub repo: https://github.com/dav-niu474/novelhermes-ai
- Vercel URL: https://novelhermes-ai.vercel.app
