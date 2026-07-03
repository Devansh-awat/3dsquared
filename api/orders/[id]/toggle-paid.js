const { query } = require('../../_db');
const { requireStaff } = require('../../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireStaff(req, res)) return;
  const { id } = req.query;
  const { rows } = await query(
    'UPDATE orders SET paid = NOT paid WHERE id = $1 RETURNING id, paid',
    [id]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.status(200).json({ id: rows[0].id, paid: rows[0].paid });
};
