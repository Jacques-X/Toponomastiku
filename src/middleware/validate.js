const { z } = require('zod');

const placenameSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(['Local Council', 'Boundaries', 'Zone Names', 'Place Names']),
  lat: z.number().min(35.7).max(36.2),
  lng: z.number().min(14.1).max(14.7),
});

const validatePlacename = (req, res, next) => {
  try {
    placenameSchema.parse(req.body);
    next();
  } catch (e) {
    return res.status(400).json({ error: "Validation Failed", issues: e.errors });
  }
};

module.exports = { validatePlacename };
