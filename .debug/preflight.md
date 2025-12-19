# Preflight Checklist

## Environment Requirements
- [ ] Node.js >= 18.x
- [ ] npm/pnpm installed
- [ ] Git configured

## Project Setup
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured (.env)
- [ ] Build passes (`npm run build`)

## Common Issues to Check Before Debugging
1. Is the correct branch checked out?
2. Are there uncommitted changes?
3. Is the dev server already running on the port?
4. Are all required services running (database, etc.)?

## Quick Commands
```bash
# Check environment
node --version
npm --version

# Verify project setup
npm install
npm run build
npm test
```
