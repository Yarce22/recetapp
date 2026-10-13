import {
  RateLimitedError,
  RecipeRejectedError,
  SuggestionServiceError,
} from '@/features/recipes/domain/recipe-suggestion-service';
import { describeServiceError } from '@/features/recipes/ui/describe-service-error';
import { createTranslator } from '@/shared/i18n/translator';

const en = createTranslator('en').t;
const es = createTranslator('es').t;

describe('describeServiceError', () => {
  it('turns the retry delay into whole minutes', () => {
    const cause = new RateLimitedError(90);

    expect(describeServiceError(cause, en, 'discover.error')).toBe(
      'You have asked a lot in the last hour. Try again in about 2 min.',
    );
    expect(describeServiceError(cause, es, 'discover.error')).toBe(
      'Has hecho muchas solicitudes en la última hora. Vuelve a intentarlo en unos 2 min.',
    );
  });

  it('names the ingredients a withheld recipe broke', () => {
    const cause = new RecipeRejectedError(['peanut', 'milk']);

    expect(describeServiceError(cause, en, 'recipe.error.generic')).toBe(
      'This recipe uses something you asked to avoid: peanut, milk',
    );
    expect(describeServiceError(cause, es, 'recipe.error.generic')).toBe(
      'Esta receta usa algo que pediste evitar: peanut, milk',
    );
  });

  it('still explains a withheld recipe that named nothing', () => {
    expect(describeServiceError(new RecipeRejectedError([]), es, 'recipe.error.generic')).toBe(
      'Esta receta usa algo que pediste evitar.',
    );
  });

  it('translates a service failure by its code', () => {
    const cause = new SuggestionServiceError('Could not reach RecetApp.', 'unreachable');

    expect(describeServiceError(cause, es, 'discover.error')).toBe(
      'No se pudo conectar con RecetApp. Revisa tu conexión.',
    );
  });

  it('falls back to the error message when there is no code', () => {
    expect(describeServiceError(new SuggestionServiceError('Custom.'), es, 'discover.error')).toBe(
      'Custom.',
    );
  });

  it('uses the screen fallback for anything unexpected', () => {
    expect(describeServiceError(new Error('boom'), es, 'discover.error')).toBe(
      'Algo salió mal al buscar platos.',
    );
  });
});
