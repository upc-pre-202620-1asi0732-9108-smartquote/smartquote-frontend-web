export async function optional(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
