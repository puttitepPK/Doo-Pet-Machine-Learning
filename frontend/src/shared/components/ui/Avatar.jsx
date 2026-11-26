import { useState } from "react";
export function Avatar({ pet, size = 64 }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <span className="avatar" style={{ width: size, height: size }}>{pet.name[0]}</span>
  ) : (
    <img className="avatar" style={{ width: size, height: size }} src={pet.img} alt={pet.name} onError={() => setBad(true)} />
  );
}
