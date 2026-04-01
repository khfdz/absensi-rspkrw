let _io = null;

function setIO(io) { _io = io; }
function getIO() {
  if (!_io) throw new Error('Socket.io belum diinisialisasi');
  return _io;
}

module.exports = { setIO, getIO };
