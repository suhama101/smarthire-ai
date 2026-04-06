# Testing

## Available scripts

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

## Run everything locally

From PowerShell at the repo root:

```powershell
Set-Location backend
npm test
Set-Location ..\frontend
npm test
```

## CI

Pushes and pull requests run the backend and frontend test suites in `.github/workflows/tests.yml`.