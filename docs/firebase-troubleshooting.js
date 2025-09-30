console.log('FIREBASE TROUBLESHOOTING GUIDE');
console.log('=====================================');

// 1. Cek konfigurasi Firebase
console.log('1. Firestore Rules yang direkomendasikan:');
console.log(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users (including anonymous)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`);

// 2. Cek Authentication
console.log('2. Pastikan Anonymous Authentication diaktifkan di Firebase Console');
console.log('   - Buka console.firebase.google.com');
console.log('   - Pilih project: productiv-task-manager');
console.log('   - Authentication → Sign-in method → Anonymous (Enable)');

// 3. Common Errors
console.log('3. Common Firebase Errors:');
console.log('   - permission-denied: Rules terlalu ketat');
console.log('   - unavailable: Network/connection issue');
console.log('   - invalid-api-key: API key salah/expired');

// 4. Testing
console.log('4. Untuk testing, buka: debug-firebase.html');

export const firebaseDebugInfo = {
    projectId: 'productiv-task-manager',
    rulesTemplate: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`,
    authRequirement: 'Anonymous authentication must be enabled',
    commonErrors: {
        'permission-denied': 'Check Firestore Rules',
        'unavailable': 'Check network connection',
        'invalid-api-key': 'Check Firebase config'
    }
};