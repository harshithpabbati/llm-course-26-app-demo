'use client';

export default function FloatingShapesBackground() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none -z-10"
      aria-hidden
    >
      <div className="absolute inset-0" style={{ perspective: '1000px' }}>
        {/* 3D cube-like shape */}
        <div
          className="absolute w-20 h-20 left-[10%] top-[20%] opacity-30"
          style={{
            animation: 'float-1 18s ease-in-out infinite',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="w-full h-full rounded-2xl bg-lavender-400/60 backdrop-blur-sm"
            style={{
              transform: 'rotateX(15deg) rotateY(25deg)',
              boxShadow:
                '0 20px 40px -15px rgba(167, 139, 250, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          />
        </div>

        {/* Sphere (circle with gradient) */}
        <div
          className="absolute w-16 h-16 left-[75%] top-[15%] rounded-full opacity-25"
          style={{
            animation: 'float-2 14s ease-in-out infinite',
            background:
              'radial-gradient(circle at 30% 30%, rgba(196, 181, 253, 0.8), rgba(139, 92, 246, 0.4))',
            boxShadow:
              '0 15px 35px -10px rgba(139, 92, 246, 0.35), inset -5px -5px 15px rgba(0,0,0,0.1)',
          }}
        />

        {/* 3D rotated square */}
        <div
          className="absolute w-24 h-24 left-[60%] top-[70%] opacity-20"
          style={{
            animation: 'float-3 16s ease-in-out infinite',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="w-full h-full rounded-xl bg-lavender-500/50 border border-lavender-400/40"
            style={{
              transform: 'rotateX(-20deg) rotateY(45deg)',
              boxShadow: '0 25px 50px -20px rgba(167, 139, 250, 0.3)',
            }}
          />
        </div>

        {/* Floating orb */}
        <div
          className="absolute w-12 h-12 left-[25%] top-[60%] rounded-full opacity-30"
          style={{
            animation: 'float-5 12s ease-in-out infinite',
            background:
              'radial-gradient(circle at 40% 40%, rgba(221, 214, 254, 0.9), rgba(167, 139, 250, 0.5))',
            boxShadow: '0 10px 30px -5px rgba(139, 92, 246, 0.4)',
          }}
        />

        {/* Small 3D tile */}
        <div
          className="absolute w-14 h-14 left-[80%] top-[45%] opacity-25"
          style={{
            animation: 'float-4 20s ease-in-out infinite',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="w-full h-full rounded-lg bg-lavender-300/70"
            style={{
              transform: 'rotateX(10deg) rotateY(-30deg)',
              boxShadow:
                '0 15px 35px -12px rgba(167, 139, 250, 0.35), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
          />
        </div>

        {/* Blob shape */}
        <div
          className="absolute w-32 h-32 left-[5%] top-[80%] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-20"
          style={{
            animation: 'float-6 22s ease-in-out infinite',
            background: 'linear-gradient(135deg, rgba(196, 181, 253, 0.6), rgba(139, 92, 246, 0.4))',
          }}
        />

        {/* Right side blob */}
        <div
          className="absolute w-28 h-28 right-[5%] top-[35%] rounded-[60%_40%_30%_70%/60%_30%_70%_40%] opacity-15"
          style={{
            animation: 'float-2 19s ease-in-out infinite reverse',
            background: 'linear-gradient(225deg, rgba(221, 214, 254, 0.7), rgba(167, 139, 250, 0.3))',
          }}
        />
      </div>
    </div>
  );
}
