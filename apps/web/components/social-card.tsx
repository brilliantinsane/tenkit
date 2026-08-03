type SocialCardProps = {
  backgroundImage: string
  label?: string
}

export function SocialCard({ backgroundImage, label }: SocialCardProps) {
  return (
    <div
      style={{
        background: "#030303",
        display: "flex",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse does not support next/image. */}
      <img
        alt=""
        src={backgroundImage}
        style={{
          height: "100%",
          inset: 0,
          objectFit: "cover",
          position: "absolute",
          width: "100%",
        }}
      />

      {label ? (
        <div
          style={{
            color: "#a3a3a3",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            fontSize: 15,
            fontWeight: 700,
            left: 62,
            letterSpacing: "3px",
            position: "absolute",
            top: 54,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  )
}
