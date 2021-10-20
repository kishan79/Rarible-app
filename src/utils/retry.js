export async function retry(num, fn) {
  try {
    return await fn();
  } catch (e) {
    if (num > 0) {
      await delay(500);
      return retry(num - 1, fn);
    } else {
      return Promise.reject(e);
    }
  }
}

function delay(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}
