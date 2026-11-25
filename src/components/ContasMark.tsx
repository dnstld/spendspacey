export function ContasMark({ className, alt }: { className: string; alt: string }) {
  return (
    <img
      src="/icons/contas-mark.png"
      className={className}
      alt={alt}
      onError={({ currentTarget }) => {
        if (!currentTarget.src.endsWith('/icons/app-192.png')) {
          currentTarget.src = '/icons/app-192.png';
        }
      }}
    />
  );
}
