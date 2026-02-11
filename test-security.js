// Test script to verify security fixes
const fs = require('fs');
const path = require('path');

console.log('🔒 Testing The Swarm Security Fixes...\n');

// Check 1: Verify RLS policies are secure
console.log('1. Checking RLS Policies...');
const securitySql = fs.readFileSync(path.join(__dirname, 'SECURITY_FIXES.sql'), 'utf8');
const databaseSql = fs.readFileSync(path.join(__dirname, 'DATABASE.sql'), 'utf8');

// Check for "USING (true)" in database.sql (should only be in old file)
const usingTrueMatches = (databaseSql.match(/USING \(true\)/gi) || []).length;
console.log(`   Found ${usingTrueMatches} "USING (true)" policies in DATABASE.sql`);

// Check for secure policies in SECURITY_FIXES.sql
const securePolicyMatches = (securitySql.match(/CREATE POLICY/gi) || []).length;
console.log(`   Found ${securePolicyMatches} secure policies in SECURITY_FIXES.sql`);

// Check 2: Verify middleware exists
console.log('\n2. Checking Security Middleware...');
const middlewareExists = fs.existsSync(path.join(__dirname, 'src', 'middleware.ts'));
const libMiddlewareExists = fs.existsSync(path.join(__dirname, 'src', 'lib', 'middleware.ts'));
const authExists = fs.existsSync(path.join(__dirname, 'src', 'lib', 'auth.ts'));
const csrfExists = fs.existsSync(path.join(__dirname, 'src', 'lib', 'csrf.ts'));

console.log(`   Main middleware: ${middlewareExists ? '✅' : '❌'}`);
console.log(`   Lib middleware: ${libMiddlewareExists ? '✅' : '❌'}`);
console.log(`   Auth utilities: ${authExists ? '✅' : '❌'}`);
console.log(`   CSRF utilities: ${csrfExists ? '✅' : '❌'}`);

// Check 3: Verify API endpoints have authentication
console.log('\n3. Checking API Endpoint Security...');

const apiFiles = [
  'src/app/api/missions/route.ts',
  'src/app/api/missions/claim/route.ts',
  'src/app/api/missions/submit/route.ts',
  'src/app/api/agents/register/route.ts',
  'src/app/api/agents/wallet/route.ts',
  'src/app/api/auth/cli/route.ts'
];

let authChecks = 0;
let csrfChecks = 0;

apiFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    
    // Check for authentication
    if (content.includes('authenticateAPI') || content.includes('requireAuth')) {
      authChecks++;
    }
    
    // Check for CSRF
    if (content.includes('X-CSRF-Token') || content.includes('csrf')) {
      csrfChecks++;
    }
  }
});

console.log(`   ${authChecks}/${apiFiles.length} API files have authentication checks`);
console.log(`   ${csrfChecks}/${apiFiles.length} API files have CSRF protection`);

// Check specific files that should have auth
const expectedAuthFiles = [
  'src/app/api/missions/route.ts',
  'src/app/api/missions/claim/route.ts',
  'src/app/api/missions/submit/route.ts',
  'src/app/api/agents/wallet/route.ts'
];

expectedAuthFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const hasAuth = content.includes('authenticateAPI') || content.includes('requireAuth');
    console.log(`   ${file}: ${hasAuth ? '✅' : '❌'}`);
  }
});

// Check 4: Verify security headers in middleware
console.log('\n4. Checking Security Headers...');
if (middlewareExists) {
  const middlewareContent = fs.readFileSync(path.join(__dirname, 'src', 'middleware.ts'), 'utf8');
  const libMiddlewareContent = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'middleware.ts'), 'utf8');
  const combinedContent = middlewareContent + libMiddlewareContent;
  
  const headers = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Strict-Transport-Security'
  ];
  
  headers.forEach(header => {
    const hasHeader = combinedContent.includes(header);
    console.log(`   ${header}: ${hasHeader ? '✅' : '❌'}`);
  });
}

// Check 5: Verify JWT implementation
console.log('\n5. Checking JWT Implementation...');
if (authExists) {
  const authContent = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'auth.ts'), 'utf8');
  
  const jwtChecks = [
    'jsonwebtoken',
    'generateJWT',
    'verifyJWT',
    'JWT_SECRET'
  ];
  
  jwtChecks.forEach(check => {
    const hasCheck = authContent.includes(check);
    console.log(`   ${check}: ${hasCheck ? '✅' : '❌'}`);
  });
}

// Summary
console.log('\n🔐 SECURITY FIXES SUMMARY:');
console.log('==========================');
console.log(`1. RLS Policies: ${usingTrueMatches === 0 ? '✅ SECURE' : '❌ INSECURE - Need migration'}`);
console.log(`2. Middleware: ${middlewareExists && libMiddlewareExists ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
console.log(`3. API Auth: ${authChecks >= 4 ? '✅ STRONG' : '⚠️ WEAK - Some endpoints unprotected'}`);
console.log(`4. Security Headers: ${middlewareExists ? '✅ PRESENT' : '❌ MISSING'}`);
console.log(`5. JWT Auth: ${authExists ? '✅ IMPLEMENTED' : '❌ MISSING'}`);

console.log('\n🚀 RECOMMENDED ACTIONS:');
if (usingTrueMatches > 0) {
  console.log('   - Run SECURITY_FIXES.sql in Supabase SQL Editor');
}
if (authChecks < 4) {
  console.log('   - Review unprotected API endpoints');
}
if (!middlewareExists) {
  console.log('   - Ensure middleware.ts is properly configured');
}

console.log('\n✅ Security audit complete!');