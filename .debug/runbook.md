# Debug Runbook

## Common Issues and Solutions

### 1. Module Not Found (TS2307, ENOENT)
**Symptoms:**
- Import statements fail
- "Cannot find module" errors

**Solutions:**
1. Check tsconfig.json paths configuration
2. Verify package is installed: `npm ls <package>`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### 2. Build Failures
**Symptoms:**
- TypeScript compilation errors
- Webpack/Vite build fails

**Solutions:**
1. Check for type errors: `npx tsc --noEmit`
2. Clear build cache
3. Update dependencies

### 3. Permission Errors
**Symptoms:**
- EACCES, EPERM errors
- Cannot write to file/folder

**Solutions:**
1. Check file/folder permissions
2. Run with appropriate privileges
3. Check if file is locked by another process

---
*Add your project-specific issues below*
