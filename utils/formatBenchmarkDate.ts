export const formatBenchmarkDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() && {
      year: 'numeric',
    }),
  });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ${time}`;
};
