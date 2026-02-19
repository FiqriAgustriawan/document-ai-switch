try {
  const panels = require('react-resizable-panels');
  console.log('react-resizable-panels loaded:', Object.keys(panels));
} catch (e) {
  console.error('Failed to load react-resizable-panels:', e.message);
}

try {
  const galaxy = require('../src/components/ui/GalaxyBackground');
  console.log('GalaxyBackground loaded:', Object.keys(galaxy));
} catch (e) {
  // Expected to fail if using ES6 syntax without babel/ts-node, but might give clue
  console.log('GalaxyBackground require attempt:', e.message);
}
