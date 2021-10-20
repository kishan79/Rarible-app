export const debounce = (...args) => (
	func,
	waitFor,
) => {
	let timeout;

	const debounced = (...args) => {
		clearTimeout(timeout)
		timeout = setTimeout(() => func(...args), waitFor)
	}

	return debounced;
}
