// Validates req.body / req.query / req.params against zod schemas and replaces them with parsed values.
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) req.validatedQuery = schemas.query.parse(req.query ?? {});
    if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = validate;
