// utils/paging.js
module.exports.getPagingParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const order = (req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const paging = (req.query.paging || 'false').toLowerCase() === 'true';
  const offset = (page - 1) * limit;

  return { page, limit, order, paging, offset };
};
