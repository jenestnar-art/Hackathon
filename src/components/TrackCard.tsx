import type { CSSProperties } from 'react'
import { ArrowUpRight, Clock3, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Track } from '@/data/tracks'

interface TrackCardProps {
  track: Track
  index: number
}

export function TrackCard({ track }: TrackCardProps) {
  const Icon = track.icon
  const cardStyle = {
    '--track-color': track.color,
    '--track-soft': track.softColor,
  } as CSSProperties

  return (
    <Link
      to={`/tracks/${track.id}`}
      aria-label={`进入${track.title}工作台`}
      className="track-card group relative flex min-h-[330px] flex-col overflow-hidden rounded-[28px] border border-[#12201e]/10 bg-white p-6 shadow-[0_18px_60px_rgba(18,32,30,0.06)] outline-none sm:p-7"
      style={cardStyle}
    >
      <div className="track-card__glow pointer-events-none absolute -right-20 -top-24 size-64 rounded-full opacity-0 blur-3xl transition duration-500" />

      <div className="relative z-10 flex items-start justify-between">
        <div
          className="grid size-14 place-items-center rounded-2xl"
          style={{ color: track.color, backgroundColor: track.softColor }}
        >
          <Icon size={27} strokeWidth={1.8} />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-[#12201e]/35">
            {track.order}
          </span>
          <span className="grid size-9 place-items-center rounded-full border border-[#12201e]/10 bg-[#f7f6f2] text-[#12201e]/55 transition duration-300 group-hover:border-[var(--track-color)] group-hover:bg-[var(--track-color)] group-hover:text-white">
            <ArrowUpRight size={17} />
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-7">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#12201e]/42">
          <span>{track.subtitle}</span>
          
        </div>
        <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#12201e]">
          {track.title}
        </h3>
        <p className="mt-4 text-sm leading-7 text-[#12201e]/62">
          {track.description}
        </p>
      </div>

      <div className="relative z-10 mt-auto pt-6">
        <div className="flex flex-wrap gap-2">
          {track.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-full border border-[#12201e]/8 bg-[#f7f6f2] px-3 py-1.5 text-xs font-medium text-[#12201e]/56"
            >
              {tool}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[#12201e]/8 pt-5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#12201e]/48">
            <Clock3 size={14} />
            {track.duration}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--track-color)]">
            <Sparkles size={14} />
            {track.outcome}
          </span>
        </div>
      </div>
    </Link>
  )
}
