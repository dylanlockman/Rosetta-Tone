export function seedDatabase(db) {
  const scales = [
    ['Major', '2,2,1,2,2,2,1'],
    ['Natural Minor', '2,1,2,2,1,2,2'],
    ['Harmonic Minor', '2,1,2,2,1,3,1'],
    ['Pentatonic Major', '2,2,3,2,3'],
    ['Pentatonic Minor', '3,2,2,3,2'],
    ['Blues', '3,2,1,1,3,2'],
    ['Dorian', '2,1,2,2,2,1,2'],
    ['Mixolydian', '2,2,1,2,2,1,2'],
  ];

  for (const [name, intervals] of scales) {
    db.run('INSERT OR IGNORE INTO scales (name, intervals) VALUES (?, ?)', [name, intervals]);
  }

  const chords = [
    ['C Major', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:1,finger:1},{string:3,fret:0,finger:0},
      {string:4,fret:2,finger:2},{string:5,fret:3,finger:3},{string:6,fret:-1,finger:0}
    ]],
    ['D Major', 'EADGBE', [
      {string:1,fret:2,finger:2},{string:2,fret:3,finger:3},{string:3,fret:2,finger:1},
      {string:4,fret:0,finger:0},{string:5,fret:-1,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['E Major', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:0,finger:0},{string:3,fret:1,finger:1},
      {string:4,fret:2,finger:3},{string:5,fret:2,finger:2},{string:6,fret:0,finger:0}
    ]],
    ['F Major', 'EADGBE', [
      {string:1,fret:1,finger:1},{string:2,fret:1,finger:1},{string:3,fret:2,finger:2},
      {string:4,fret:3,finger:3},{string:5,fret:3,finger:4},{string:6,fret:1,finger:1}
    ]],
    ['G Major', 'EADGBE', [
      {string:1,fret:3,finger:4},{string:2,fret:0,finger:0},{string:3,fret:0,finger:0},
      {string:4,fret:0,finger:0},{string:5,fret:2,finger:1},{string:6,fret:3,finger:2}
    ]],
    ['A Major', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:2,finger:3},{string:3,fret:2,finger:2},
      {string:4,fret:2,finger:1},{string:5,fret:0,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['B Major', 'EADGBE', [
      {string:1,fret:2,finger:1},{string:2,fret:4,finger:3},{string:3,fret:4,finger:4},
      {string:4,fret:4,finger:2},{string:5,fret:2,finger:1},{string:6,fret:-1,finger:0}
    ]],
    ['Am', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:1,finger:1},{string:3,fret:2,finger:3},
      {string:4,fret:2,finger:2},{string:5,fret:0,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['Bm', 'EADGBE', [
      {string:1,fret:2,finger:1},{string:2,fret:3,finger:2},{string:3,fret:4,finger:4},
      {string:4,fret:4,finger:3},{string:5,fret:2,finger:1},{string:6,fret:-1,finger:0}
    ]],
    ['Dm', 'EADGBE', [
      {string:1,fret:1,finger:1},{string:2,fret:3,finger:3},{string:3,fret:2,finger:2},
      {string:4,fret:0,finger:0},{string:5,fret:-1,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['Em', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:0,finger:0},{string:3,fret:0,finger:0},
      {string:4,fret:2,finger:3},{string:5,fret:2,finger:2},{string:6,fret:0,finger:0}
    ]],
    ['A7', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:2,finger:2},{string:3,fret:0,finger:0},
      {string:4,fret:2,finger:1},{string:5,fret:0,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['B7', 'EADGBE', [
      {string:1,fret:2,finger:4},{string:2,fret:0,finger:0},{string:3,fret:2,finger:3},
      {string:4,fret:1,finger:1},{string:5,fret:2,finger:2},{string:6,fret:-1,finger:0}
    ]],
    ['D7', 'EADGBE', [
      {string:1,fret:2,finger:2},{string:2,fret:1,finger:1},{string:3,fret:2,finger:3},
      {string:4,fret:0,finger:0},{string:5,fret:-1,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['E7', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:0,finger:0},{string:3,fret:1,finger:1},
      {string:4,fret:0,finger:0},{string:5,fret:2,finger:2},{string:6,fret:0,finger:0}
    ]],
    ['G7', 'EADGBE', [
      {string:1,fret:1,finger:1},{string:2,fret:0,finger:0},{string:3,fret:0,finger:0},
      {string:4,fret:0,finger:0},{string:5,fret:2,finger:2},{string:6,fret:3,finger:3}
    ]],
    ['Am7', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:1,finger:1},{string:3,fret:0,finger:0},
      {string:4,fret:2,finger:2},{string:5,fret:0,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['Dm7', 'EADGBE', [
      {string:1,fret:1,finger:1},{string:2,fret:1,finger:1},{string:3,fret:2,finger:2},
      {string:4,fret:0,finger:0},{string:5,fret:-1,finger:0},{string:6,fret:-1,finger:0}
    ]],
    ['Cmaj7', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:0,finger:0},{string:3,fret:0,finger:0},
      {string:4,fret:2,finger:2},{string:5,fret:3,finger:3},{string:6,fret:-1,finger:0}
    ]],
    ['Fmaj7', 'EADGBE', [
      {string:1,fret:0,finger:0},{string:2,fret:1,finger:1},{string:3,fret:2,finger:3},
      {string:4,fret:3,finger:4},{string:5,fret:-1,finger:0},{string:6,fret:-1,finger:0}
    ]],
  ];

  for (const [name, tuning, fingering] of chords) {
    db.run('INSERT OR IGNORE INTO chords (name, tuning, fingering) VALUES (?, ?, ?)',
      [name, tuning, JSON.stringify(fingering)]);
  }
}
