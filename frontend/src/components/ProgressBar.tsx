interface Props {
  rate: number     // 0.0 - 1.0
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function ProgressBar({ rate, label, size = 'md' }: Props) {
  const pct = Math.round(rate * 100)
  const heights = { sm: 'h-1.5', md: 'h-3', lg: 'h-5' }

  const color = pct < 30 ? 'bg-red-400' : pct < 70 ? 'bg-yellow-400' : 'bg-green-400'

  return (
    <div className="w-full">
      {(label || true) && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{label || '进度'}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${color} ${heights[size]} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}
