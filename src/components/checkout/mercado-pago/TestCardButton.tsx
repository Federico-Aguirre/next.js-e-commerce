type TestCardButtonProps = {
  onClick: () => void;
};

export default function TestCardButton({ onClick }: TestCardButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-6 w-full rounded-lg border border-yellow-300 bg-yellow-100 px-4 py-2.5 text-sm font-semibold text-yellow-800 transition-colors hover:bg-yellow-200"
    >
      ⚡ Autocompletar todo con tarjeta de prueba
    </button>
  );
}
