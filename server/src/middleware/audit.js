import { query } from '../config/db.js';

export async function writeAuditLog({
  req,
  action,
  entity = null,
  entityId = null,
  details = null
}) {
  try {
    const adminId = req.admin?.id || null;

    const ip = req.ip
      ? String(req.ip).slice(0, 100)
      : null;

    const safeAction = String(action).slice(0, 100);
    const safeEntity = entity
      ? String(entity).slice(0, 100)
      : null;

    const safeEntityId = entityId === null
      ? null
      : String(entityId).slice(0, 100);

    const safeDetails = details === null
      ? null
      : JSON.stringify(details);

    await query(
      `INSERT INTO audit_logs
        (admin_id, action, entity, entity_id, details, ip)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        adminId,
        safeAction,
        safeEntity,
        safeEntityId,
        safeDetails,
        ip
      ]
    );

    return true;
  } catch (error) {
    console.error('Audit log error:', error.message);
    return false;
  }
}