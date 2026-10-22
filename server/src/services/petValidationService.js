/**
 * Pet Management Validation Service
 * Validates pet registration and profile updates according to PBGMS SRS business rules
 */

const ALLOWED_SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];

/**
 * Validates pet registration or profile update payload.
 * @param {Object} petData - Pet details.
 * @param {string} petData.name - Name of pet.
 * @param {string} petData.species - Species of pet (Dog, Cat, etc.).
 * @param {string} [petData.breed] - Breed of pet.
 * @returns {{ isValid: boolean, errors: string[], sanitized: Object }}
 */
function validatePetInput(petData = {}) {
  const errors = [];
  const name = petData.name ? String(petData.name).trim() : '';
  const species = petData.species ? String(petData.species).trim() : '';
  const breed = petData.breed ? String(petData.breed).trim() : 'Mixed Breed';

  if (!name) {
    errors.push('Pet name is mandatory and cannot be empty.');
  } else if (name.length > 50) {
    errors.push('Pet name exceeds maximum length of 50 characters.');
  }

  if (!species) {
    errors.push('Pet species is mandatory and cannot be empty.');
  } else {
    const formattedSpecies = species.charAt(0).toUpperCase() + species.slice(1).toLowerCase();
    if (!ALLOWED_SPECIES.includes(formattedSpecies)) {
      errors.push(`Species '${species}' is unsupported. Allowed species: ${ALLOWED_SPECIES.join(', ')}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name,
      species: species ? species.charAt(0).toUpperCase() + species.slice(1).toLowerCase() : '',
      breed
    }
  };
}

module.exports = {
  validatePetInput,
  ALLOWED_SPECIES
};
