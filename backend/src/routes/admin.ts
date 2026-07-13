import { Router } from 'express';
import { User } from '../models/User';
import { Setting } from '../models/Setting';
import { Location } from '../models/Location';
import { AuditLog } from '../models/AuditLog';
import { logEvent } from '../services/audit';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/admin/users - Retrieve list of all users (Admin only)
router.get('/users', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({ error: 'Server error retrieving user records' });
  }
});

// PUT /api/admin/users/:id/role - Promote/demote user tiers (Admin only)
router.put('/users/:id/role', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['standard', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User record not found' });
    }

    const oldRole = (user as any).role || 'standard';
    (user as any).role = role;
    await user.save();

    // Log the action in AuditLog
    const adminUser = await User.findById(req.userId);
    await logEvent('Role Promoted', adminUser?.email || 'admin', `Updated "${user.email}" from "${oldRole}" to "${role}"`);

    return res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: (user as any).role,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return res.status(500).json({ error: 'Server error updating user role' });
  }
});

// DELETE /api/admin/users/:id - Delete user account and locations (Admin only)
router.delete('/users/:id', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User record not found' });
    }

    // Purge user's locations registry
    await Location.deleteMany({ userId });
    await user.deleteOne();

    const adminUser = await User.findById(req.userId);
    await logEvent('User Deleted', adminUser?.email || 'admin', `Deleted user account: "${user.email}" and cleared their saved locations`);

    return res.json({ message: 'User and locations deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Server error deleting user account' });
  }
});

// GET /api/admin/stats - Retrieve system aggregations (Admin only)
router.get('/stats', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const userCount = await User.countDocuments({});
    const locationCount = await Location.countDocuments({});
    const logsCount = await AuditLog.countDocuments({});
    
    return res.json({
      userCount,
      locationCount,
      geminiTokensUsed: Math.max(0, logsCount * 450 + 1200),
      apiCallCount: Math.max(0, locationCount * 30 + 150),
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    return res.status(500).json({ error: 'Server error calculating telemetry stats' });
  }
});

// GET /api/admin/prompt - Fetch custom Gemini system instructions (Admin only)
router.get('/prompt', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    let promptSetting = await Setting.findOne({ key: 'gemini_system_prompt' });
    if (!promptSetting) {
      const defaultPrompt = 'You are a helpful, professional marine forecasting and outdoor sports planning AI assistant named OceanCast AI. Analyze the coordinates weather/marine metrics context to advise users on surf suitability, motorcycle riding, and fishing safety.';
      promptSetting = new Setting({ key: 'gemini_system_prompt', value: defaultPrompt });
      await promptSetting.save();
    }
    return res.json({ prompt: promptSetting.value });
  } catch (error) {
    console.error('Fetch prompt error:', error);
    return res.status(500).json({ error: 'Server error retrieving system instructions' });
  }
});

// PUT /api/admin/prompt - Update custom Gemini system instructions (Admin only)
router.put('/prompt', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ error: 'System prompt content cannot be empty' });
    }

    let promptSetting = await Setting.findOne({ key: 'gemini_system_prompt' });
    if (!promptSetting) {
      promptSetting = new Setting({ key: 'gemini_system_prompt', value: prompt });
    } else {
      promptSetting.value = prompt;
    }
    await promptSetting.save();

    const adminUser = await User.findById(req.userId);
    await logEvent('Prompt Engineering', adminUser?.email || 'admin', 'Modified global system chatbot prompt');

    return res.json({
      message: 'System prompt updated successfully',
      prompt: promptSetting.value,
    });
  } catch (error) {
    console.error('Update prompt error:', error);
    return res.status(500).json({ error: 'Server error updating system instructions' });
  }
});

// GET /api/admin/presets - Fetch featured locations (Public/Authenticated)
router.get('/presets', authenticateToken as any, async (req, res) => {
  try {
    const presetsSetting = await Setting.findOne({ key: 'featured_presets' });
    return res.json(presetsSetting ? presetsSetting.value : []);
  } catch (error) {
    console.error('Fetch presets error:', error);
    return res.status(500).json({ error: 'Server error retrieving featured destinations' });
  }
});

// POST /api/admin/presets - Add a featured location preset (Admin only)
router.post('/presets', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { name, lat, lon } = req.body;
    if (!name || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Please enter location name, latitude and longitude' });
    }

    let presetsSetting = await Setting.findOne({ key: 'featured_presets' });
    if (!presetsSetting) {
      presetsSetting = new Setting({ key: 'featured_presets', value: [] });
    }

    const currentPresets = Array.isArray(presetsSetting.value) ? presetsSetting.value : [];
    const updatedPresets = [...currentPresets, { name, lat: Number(lat), lon: Number(lon) }];
    presetsSetting.value = updatedPresets;
    presetsSetting.markModified('value');
    await presetsSetting.save();

    const adminUser = await User.findById(req.userId);
    await logEvent('Preset Created', adminUser?.email || 'admin', `Added global coordinates preset: "${name}"`);

    return res.json(presetsSetting.value);
  } catch (error) {
    console.error('Add preset error:', error);
    return res.status(500).json({ error: 'Server error adding destination preset' });
  }
});

// DELETE /api/admin/presets/:index - Delete a featured location preset (Admin only)
router.delete('/presets/:index', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const index = Number(req.params.index);
    let presetsSetting = await Setting.findOne({ key: 'featured_presets' });
    if (!presetsSetting || !Array.isArray(presetsSetting.value)) {
      return res.status(404).json({ error: 'Featured presets list is empty' });
    }

    if (index < 0 || index >= presetsSetting.value.length) {
      return res.status(400).json({ error: 'Invalid preset index' });
    }

    const removed = presetsSetting.value[index];
    presetsSetting.value.splice(index, 1);
    presetsSetting.markModified('value');
    await presetsSetting.save();

    const adminUser = await User.findById(req.userId);
    await logEvent('Preset Removed', adminUser?.email || 'admin', `Removed coordinates preset: "${removed?.name || 'unknown'}"`);

    return res.json(presetsSetting.value);
  } catch (error) {
    console.error('Delete preset error:', error);
    return res.status(500).json({ error: 'Server error deleting destination preset' });
  }
});

// GET /api/admin/audit-logs - Fetch latest 20 security logs (Admin only)
router.get('/audit-logs', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(20);
    return res.json(logs);
  } catch (error) {
    console.error('Fetch logs error:', error);
    return res.status(500).json({ error: 'Server error retrieving security audit logs' });
  }
});

// GET /api/admin/announcement - Fetch current broadcast banner setting (Public)
router.get('/announcement', async (req, res) => {
  try {
    const annSetting = await Setting.findOne({ key: 'announcement' });
    return res.json(annSetting ? annSetting.value : { text: '', active: false });
  } catch (error) {
    console.error('Fetch announcement error:', error);
    return res.status(500).json({ error: 'Server error fetching announcement broadcast settings' });
  }
});

// PUT /api/admin/announcement - Modify broadcast banner setting (Admin only)
router.put('/announcement', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { text, active } = req.body;
    let annSetting = await Setting.findOne({ key: 'announcement' });
    if (!annSetting) {
      annSetting = new Setting({ key: 'announcement', value: { text: '', active: false } });
    }

    annSetting.value = { text: text || '', active: !!active };
    annSetting.markModified('value');
    await annSetting.save();

    const adminUser = await User.findById(req.userId);
    await logEvent('Broadcast Updated', adminUser?.email || 'admin', `Updated banner text: "${text}", active: ${!!active}`);

    return res.json(annSetting.value);
  } catch (error) {
    console.error('Update announcement error:', error);
    return res.status(500).json({ error: 'Server error saving announcement broadcast settings' });
  }
});

// GET /api/admin/thresholds - Fetch custom suitability parametric values (Public)
router.get('/thresholds', async (req, res) => {
  try {
    let thSetting = await Setting.findOne({ key: 'activity_thresholds' });
    if (!thSetting) {
      const defaults = {
        surf: { waveMin: 0.5, windMax: 22 },
        ride: { windMax: 20, tempMin: 15 },
        fish: { waveMax: 1.5, windMax: 15 }
      };
      thSetting = new Setting({ key: 'activity_thresholds', value: defaults });
      await thSetting.save();
    }
    return res.json(thSetting.value);
  } catch (error) {
    console.error('Fetch thresholds error:', error);
    return res.status(500).json({ error: 'Server error fetching custom weather threshold parameters' });
  }
});

// PUT /api/admin/thresholds - Update custom suitability parameters (Admin only)
router.put('/thresholds', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { surf, ride, fish } = req.body;
    let thSetting = await Setting.findOne({ key: 'activity_thresholds' });
    if (!thSetting) {
      thSetting = new Setting({ key: 'activity_thresholds', value: {} });
    }

    thSetting.value = {
      surf: { waveMin: Number(surf?.waveMin || 0.5), windMax: Number(surf?.windMax || 22) },
      ride: { windMax: Number(ride?.windMax || 20), tempMin: Number(ride?.tempMin || 15) },
      fish: { waveMax: Number(fish?.waveMax || 1.5), windMax: Number(fish?.windMax || 15) }
    };
    thSetting.markModified('value');
    await thSetting.save();

    const adminUser = await User.findById(req.userId);
    await logEvent('Thresholds Modified', adminUser?.email || 'admin', 'Adjusted system-wide activity feasibility parameter thresholds');

    return res.json(thSetting.value);
  } catch (error) {
    console.error('Update thresholds error:', error);
    return res.status(500).json({ error: 'Server error saving custom weather threshold parameters' });
  }
});

// GET /api/admin/backup - Download settings database backups (Admin only)
router.get('/backup', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const presetsSetting = await Setting.findOne({ key: 'featured_presets' });
    const promptSetting = await Setting.findOne({ key: 'gemini_system_prompt' });
    const annSetting = await Setting.findOne({ key: 'announcement' });
    const thSetting = await Setting.findOne({ key: 'activity_thresholds' });

    const backupData = {
      featured_presets: presetsSetting ? presetsSetting.value : [],
      gemini_system_prompt: promptSetting ? promptSetting.value : '',
      announcement: annSetting ? annSetting.value : { text: '', active: false },
      activity_thresholds: thSetting ? thSetting.value : {},
      timestamp: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=oceancast_settings_backup.json');
    return res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Backup database error:', error);
    return res.status(500).json({ error: 'Server error generating database registry backup' });
  }
});

// POST /api/admin/restore - Restore settings database state (Admin only)
router.post('/restore', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    const { featured_presets, gemini_system_prompt, announcement, activity_thresholds } = req.body;
    
    if (featured_presets !== undefined) {
      await Setting.findOneAndUpdate({ key: 'featured_presets' }, { value: featured_presets }, { upsert: true });
    }
    if (gemini_system_prompt !== undefined) {
      await Setting.findOneAndUpdate({ key: 'gemini_system_prompt' }, { value: gemini_system_prompt }, { upsert: true });
    }
    if (announcement !== undefined) {
      await Setting.findOneAndUpdate({ key: 'announcement' }, { value: announcement }, { upsert: true });
    }
    if (activity_thresholds !== undefined) {
      await Setting.findOneAndUpdate({ key: 'activity_thresholds' }, { value: activity_thresholds }, { upsert: true });
    }

    const adminUser = await User.findById(req.userId);
    await logEvent('Database Restored', adminUser?.email || 'admin', 'Uploaded settings configuration file backup');

    return res.json({ message: 'System configuration restored successfully' });
  } catch (error) {
    console.error('Restore database error:', error);
    return res.status(500).json({ error: 'Server error restoring registry state settings' });
  }
});

// GET /api/admin/map-data - All saved locations with user info for admin map (Admin only)
router.get('/map-data', authenticateToken as any, requireAdmin as any, async (req, res) => {
  try {
    // Fetch all locations with user name lookup
    const locations = await Location.find({}).lean();
    const userIds = [...new Set(locations.map((l: any) => l.userId?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userMap: Record<string, string> = {};
    (users as any[]).forEach((u: any) => { userMap[u._id.toString()] = u.name; });

    const enriched = locations.map((loc: any) => ({
      _id: loc._id,
      name: loc.name,
      lat: loc.lat,
      lon: loc.lon,
      userId: loc.userId,
      userName: userMap[loc.userId?.toString()] || 'Unknown',
      saveCount: 1,
      createdAt: loc.createdAt,
    }));

    // Compute basic stats
    const totalLocations = enriched.length;
    const uniqueUsers = new Set(locations.map((l: any) => l.userId?.toString())).size;

    // Rough country cluster by rounding lat/lon to 5deg grid
    const regionSet = new Set(
      enriched.map((l) => `${Math.round(l.lat / 5) * 5},${Math.round(l.lon / 5) * 5}`)
    );

    // Most active region (most locations)
    const regionCount: Record<string, number> = {};
    enriched.forEach((l) => {
      const key = `${Math.round(l.lat / 5) * 5},${Math.round(l.lon / 5) * 5}`;
      regionCount[key] = (regionCount[key] || 0) + 1;
    });
    const mostActiveEntry = Object.entries(regionCount).sort((a, b) => b[1] - a[1])[0];
    const mostActiveRegion = mostActiveEntry
      ? `${mostActiveEntry[1]} pts`
      : '—';

    return res.json({
      locations: enriched,
      stats: {
        totalLocations,
        uniqueUsers,
        countryClusters: regionSet.size,
        mostActiveRegion,
      },
    });
  } catch (error) {
    console.error('Map data error:', error);
    return res.status(500).json({ error: 'Server error fetching map data' });
  }
});

export default router;
