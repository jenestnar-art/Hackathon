import { Waypoints } from 'lucide-react'

interface BrandMarkProps {
  tone?: 'light' | 'dark'
  compact?: boolean
}

export function BrandMark({ tone = 'dark', compact = false }: BrandMarkProps) {
  const isLight = tone === 'light'

  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          'grid shrink-0 place-items-center rounded-2xl ring-1',
          compact ? 'size-9' : 'size-11',
          isLight
            ? 'bg-white/10 text-[#d7ff68] ring-white/15'
            : 'bg-[#12201e] text-[#d7ff68] ring-[#12201e]/10',
        ].join(' ')}
      >
        <Waypoints size={compact ? 18 : 22} strokeWidth={2.1} />
      </div>
      <div className="leading-none">
        <div
          className={[
            'font-semibold tracking-[-0.04em]',
            compact ? 'text-lg' : 'text-xl',
            isLight ? 'text-white' : 'text-[#12201e]',
          ].join(' ')}
        >
          代码岔路口
        </div>
        {!compact && (
          <div
            className={[
              'mt-1 text-[10px] font-semibold tracking-[0.22em]',
              isLight ? 'text-white/45' : 'text-[#12201e]/45',
            ].join(' ')}
          >
            CODE CROSSROADS
          </div>
        )}
      </div>
    </div>
  )
}
