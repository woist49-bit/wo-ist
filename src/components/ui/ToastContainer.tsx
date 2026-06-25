import { useToast } from '../../stores/toast'

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .toast-enter {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 pointer-events-none">
        <div className="flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`toast-enter p-4 rounded-lg text-white text-sm font-medium shadow-lg pointer-events-auto ${
                toast.type === 'success'
                  ? 'bg-green-600'
                  : toast.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-indigo-600'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-white/60 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
