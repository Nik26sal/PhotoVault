import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../Model/userModel.js';
import { Photo } from '../Model/photoModel.js';
import { verifyJWT } from '../middlewares/verifyJWT.js';
import { upload } from '../middlewares/multer.js';
import cloudinary from 'cloudinary';

cloudinary.config({
    cloud_name: 'dhnzzqzap',
    api_key: '642518419392335',
    api_secret: 'mFSvO84Dwvvs3SX9g2d9JOBzloQ'
});


const router = Router();

// Register a new user
router.post("/register", async (req, res) => {
    try {
        const { fullname, username, password } = req.body;

        if (!fullname || !username || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existedUser = await User.findOne({ username });
        console.log(existedUser)
        if (existedUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        const user = await User.create({
            fullname,
            username: username.toLowerCase(),
            password: password
        });
        console.log(user+"%%%%%%%%%%%%%%%%%%%%%%%%%%")
        const createdUser = await User.findById(user._id).select("-password");
        console.log(createdUser)

        if (!createdUser) {
            return res.status(500).json({ message: "Error registering user" });
        }

        return res.status(201).json(createdUser);
    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ message: 'User does not exist' });
        }
        const isPasswordValid = await user.isPasswordCorrect(password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Password incorrect' });
        }

        const token = jwt.sign(
            {
                _id: user._id,
                username: user.username,
                fullname: user.fullname,
            },
            "jofjsdskvdjhwslvndkblvnhdlvbdolbhdpbhdolbnflkndlbdbidlbn", 
            {
                expiresIn: '2d',
            }
        );

        const photos = await Photo.find({ owner: user._id });

        const userToSend = {
            _id: user._id,
            username: user.username,
            fullname: user.fullname,
            pictures: photos
        };

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res.status(200)
            .cookie('token', token, options)
            .json({ message: 'User logged in successfully', user: userToSend, photos,token });
    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
router.post('/logout', verifyJWT, async (req, res) => {
    try {
        const options = {
            httpOnly: true,
            secure: true,
        };

        return res.status(200)
            .clearCookie("token", options)
            .json({ message: "User logged out successfully" });
    } catch (error) {
        console.error('Error logging out user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// Upload photo route
router.post('/upload', verifyJWT, upload.array('photos'), async (req, res) => {
    try {
        const photoFiles = req.files.map(file => file.path);
        const uploadedPhotos = await Promise.all(photoFiles.map(async filePath => {
            const result = await cloudinary.uploader.upload(filePath);
            return result.secure_url;
        }));

        const { description } = req.body;
        const owner = req.user._id;
        
        const newPhoto = new Photo({
            photoFiles: uploadedPhotos,
            description,
            owner
        });

        await newPhoto.save();

        res.status(201).json({ message: "Photo uploaded successfully", photo: newPhoto });
    } catch (error) {
        console.error("Error uploading photo:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// Fetch user's photos route
router.get('/photos', verifyJWT, async (req, res) => {
    try {
        const photos = await Photo.find({ owner: req.user._id });
        res.status(200).json(photos);
    } catch (error) {
        console.error("Error fetching user's photos:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete photo route
router.delete('/photos/:id', verifyJWT, async (req, res) => {
    try {
        const photoId = req.params.id;
        const userId = req.user._id;
        const photo = await Photo.findById(photoId);
        if (!photo || photo.owner.toString() !== userId.toString()) {
            return res.status(404).json({ message: "Photo not found or you do not have permission to delete this photo" });
        }
        await Photo.findByIdAndDelete(photoId);
        return res.status(200).json({ message: "Photo deleted successfully" });
    } catch (error) {
        console.error("Error deleting photo:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});



export default router;
