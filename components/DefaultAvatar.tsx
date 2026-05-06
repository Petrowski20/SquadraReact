import Svg, { Circle, Rect } from "react-native-svg";

interface Props {
  size?: number;
  color?: string;
}

export default function DefaultAvatar({ size = 44, color = "#9ca3af" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 150" fill="none">
      <Circle cx="50" cy="35" r="22" fill={color} />
      <Rect x="22" y="65" width="56" height="75" rx="15" fill={color} />
    </Svg>
  );
}
