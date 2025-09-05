function levenshtein(a, b) {
  const matrix = [];

  // Initialisation des lignes
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialisation des colonnes
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Remplissage de la matrice
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // suppression
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Fonction de similarité (0 = différent, 1 = identique)
function similarity(a, b) {
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

// Trouver la meilleure correspondance dans une liste
function findBestMatch(phrase, list) {
  let bestMatch = null;
  let highestScore = -1;

  for (const candidate of list) {
    const score = similarity(phrase, candidate);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = candidate;
    }
  }

  return { match: bestMatch, score: highestScore };
}