// Minimal ZIP (store method) + 3MF model writer, dependency-free.
// Produces a valid, minimal .3MF with per-object base-color materials
// (readable by Bambu Studio / most slicers that support 3MF core + materials).

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

// ---------- ZIP (store, no compression) ----------
function dosDateTime(date) {
  const y = Math.max(0, date.getFullYear() - 1980);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dateN = (y << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dateN };
}

export function buildZip(files) {
  // files: [{name, data(Uint8Array|string)}]
  const now = new Date();
  const { time, date } = dosDateTime(now);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = strToBytes(f.name);
    const data = typeof f.data === 'string' ? strToBytes(f.data) : f.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // method = store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    localParts.push(new Uint8Array(local.buffer), nameBytes, data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);

    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const p of centralParts) centralSize += p.length;

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);
  end.setUint16(20, 0, true);

  const all = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  let total = 0;
  for (const p of all) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return new Blob([out], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' });
}

// ---------- Geometry helpers ----------
function boxMesh(w, d, h, ox = 0, oy = 0, oz = 0) {
  // returns {vertices:[[x,y,z]...], triangles:[[a,b,c]...]}
  const x0 = ox - w / 2, x1 = ox + w / 2;
  const y0 = oy - d / 2, y1 = oy + d / 2;
  const z0 = oz, z1 = oz + h;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const t = [
    [0, 1, 2], [0, 2, 3], // bottom
    [4, 6, 5], [4, 7, 6], // top
    [0, 4, 5], [0, 5, 1], // front
    [1, 5, 6], [1, 6, 2], // right
    [2, 6, 7], [2, 7, 3], // back
    [3, 7, 4], [3, 4, 0], // left
  ];
  return { vertices: v, triangles: t };
}

function ringHoleMesh(cx, cy, z, h, rOuter, rInner, segs = 24) {
  // annulus (keyring hole) extruded — approximated as thin ring prism
  const verts = [];
  const tris = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    const p = (r, a, zz) => [cx + r * Math.cos(a), cy + r * Math.sin(a), zz];
    const base = verts.length;
    verts.push(p(rOuter, a0, z), p(rOuter, a1, z), p(rInner, a1, z), p(rInner, a0, z));
    verts.push(p(rOuter, a0, z + h), p(rOuter, a1, z + h), p(rInner, a1, z + h), p(rInner, a0, z + h));
    // bottom ring quad, top ring quad, outer wall, inner wall
    tris.push([base + 0, base + 1, base + 2], [base + 0, base + 2, base + 3]); // bottom
    tris.push([base + 4, base + 6, base + 5], [base + 4, base + 7, base + 6]); // top
    tris.push([base + 0, base + 5, base + 1], [base + 0, base + 4, base + 5]); // outer
    tris.push([base + 3, base + 2, base + 6], [base + 3, base + 6, base + 7]); // inner
  }
  return { vertices: verts, triangles: tris };
}

// ---------- 3MF model XML ----------
function meshToXml(mesh, pid, pindex, offsetV) {
  const vlines = mesh.vertices.map(v => `<vertex x="${v[0].toFixed(3)}" y="${v[1].toFixed(3)}" z="${v[2].toFixed(3)}"/>`).join('');
  const tlines = mesh.triangles.map(t => `<triangle v1="${t[0] + offsetV}" v2="${t[1] + offsetV}" v3="${t[2] + offsetV}" pid="${pid}" p1="${pindex}"/>`).join('');
  return { vlines, tlines, count: mesh.vertices.length };
}

// specs: { widthMM, depthMM, heightMM, textHeightMM, baseColorHex, textColorHex, hasHole }
export function build3MFModel(specs) {
  const {
    widthMM = 50, depthMM = 25, heightMM = 3, textHeightMM = 1.2,
    baseColorHex = '#1a1a1a', textColorHex = '#ffffff', hasHole = true,
  } = specs;

  const baseMesh = boxMesh(widthMM, depthMM, heightMM, 0, 0, 0);
  const plateW = widthMM * 0.7, plateD = depthMM * 0.4;
  const textMesh = boxMesh(plateW, plateD, textHeightMM, 0, 0, heightMM);

  let objectsXml = '';
  let vOffset = 0;
  let baseVerts = 0, meshBlocks = [];

  const m1 = meshToXml(baseMesh, 2, 0, 0);
  meshBlocks.push(m1);
  vOffset += m1.count;
  const m2 = meshToXml(textMesh, 2, 1, vOffset);
  meshBlocks.push(m2);
  vOffset += m2.count;

  let holeXml = { vlines: '', tlines: '', count: 0 };
  if (hasHole) {
    const holeMesh = ringHoleMesh(0, -depthMM / 2 + 4, 0, heightMM, 3.2, 1.6);
    holeXml = meshToXml(holeMesh, 2, 0, vOffset);
    vOffset += holeXml.count;
  }

  const allVerts = meshBlocks.map(b => b.vlines).join('') + holeXml.vlines;
  const allTris = meshBlocks.map(b => b.tlines).join('') + holeXml.tlines;

  const hexToFrac = (hex) => {
    const h = hex.replace('#', '');
    return '#' + h.toUpperCase() + 'FF';
  };

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <resources>
    <basematerials id="2">
      <base name="BaseColor" displaycolor="${hexToFrac(baseColorHex)}"/>
      <base name="TextColor" displaycolor="${hexToFrac(textColorHex)}"/>
    </basematerials>
    <object id="1" type="model" pid="2" pindex="0">
      <mesh>
        <vertices>${allVerts}</vertices>
        <triangles>${allTris}</triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;
  return model;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

export function generate3MFBlob(specs) {
  const modelXml = build3MFModel(specs);
  return buildZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: RELS },
    { name: '3D/3dmodel.model', data: modelXml },
  ]);
}
