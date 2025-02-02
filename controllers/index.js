const Contacts = require('../models/Contact')
const Users = require('../models/user')
const fs = require('fs').promises
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const gravatar = require('gravatar');
const path = require('path');
const multer = require('multer');
const uploadPath = path.join(process.cwd(), 'tmp');
const imagesPath = path.join(process.cwd(), 'public/avatars');
const Jimp = require("jimp");
const { v4: uuidv4 } = require('uuid');
const verifyemail = require('../utils/verifyemail')


const userschemaJoi = Joi.object({
  password: Joi.string().required(),
  email: Joi.string().email().required(),
  subscription: Joi.string().valid('starter', 'pro', 'business')
})

const subscriptionJoi = Joi.object({
  subscription : Joi.string().valid('starter', 'pro', 'business')
})


const contactController = {
    async getContacts(req, res, next) {
        try {
            const { favorite, page, limit } = req.query;
            if (favorite && favorite !== "true" && favorite !== "false") {
                return res.status(400).json({
                    code: "400",
                    message: "Invalid parametets, favorites must be true or false",
                    data: favorite,
                })
            }

            let startpage = parseInt(page)
            let displayCnt = parseInt(limit)
            if (isNaN(startpage)) { startpage = 1 }
            let postCount = 0
            if (!favorite) {
                // postCount = await Contacts.countDocuments({ owner: req.session.userID }).exec();
                                postCount = await Contacts.countDocuments({}).exec();

            } else {
                // postCount = await Contacts.countDocuments({ owner: req.session.userID, favorite: favorite }).exec();
                postCount = await Contacts.countDocuments({ favorite: favorite }).exec();

            }
            if (postCount === 0) {
                return res.status(404).json({
                    code: "404",
                    message: "No Contacts were found",
                    
                })
            }
            if (isNaN(displayCnt)) { displayCnt = postCount; startpage = 1 }
            const totalPages = Math.ceil(postCount / displayCnt)
            if (startpage < 1 || startpage > totalPages) {
                return res.status(400).json({
                    code: "400",
                    message: `Invalid page number.  page number must be 1 - ${totalPages}`,
                   
                })
            }

            let data
            if (!favorite) {
                // data = await Contacts.find({ owner: req.session.userID }).skip((startpage * displayCnt) - displayCnt).limit(displayCnt);
                            data = await Contacts.find().skip((startpage * displayCnt) - displayCnt).limit(displayCnt);

            } else {
                // data = await Contacts.find({ owner: req.session.userID, favorite: favorite }).skip((startpage * displayCnt) - displayCnt).limit(displayCnt);
                data = await Contacts.find({ favorite: favorite }).skip((startpage * displayCnt) - displayCnt).limit(displayCnt);

            }
            return res.status(200).json({
                code: "200",
                message: `Contact list page ${startpage} of ${totalPages}`,
                data: data,
            })


        } catch (err) {
            res.status(400).json({
                code: '400',
                Massage: "An error has accurred",
                error: err,
            });
        }

    },
    async createContact(req, res, next) {
        try {
            const { name, email, phone, favorie } = req.body;
            const createContact = {
                name,
                email,
                phone,
                favorie,
                owner: req.session.userID,
            }

            const newContact = await Contacts.create(createContact);
            verifyemail(createContact)
            return res.status(201).json({
                code: "201",
                message: "Contact was created",
                data: newContact,
            })
                
        } catch (err) {
            return res.status(400).json({
                code: '400',
                Massage: "An error has accurred",
                error: err
            });
        }

    },
    async getSingleContacts(req, res, next) {
        try {
            const data = await Contacts.findOne({ owner: req.session.userID, _id: req.params.id });
            res.status(201).json({
                code: "201",
                message: "Single Contact",
                data: data,
            }
            )
        } catch (err) {
            res.status(400).json({
                code: '400',
                Massage: `No contact was found for id ${req.params.id}`,
                error: err,
            });
        }
    },
    
    
    async deleteContacts(req, res, next) {
        try {
            const data = await Contacts.findOneAndDelete({ _id: req.params.id, owner: req.session.userID });
            res.status(200).json({
                code: "200",
                message: "Contact Deleted",
                data: data,
            }
            )
        } catch (err) {
            return res.status(400).json({
                code: '400',
                Massage: `No contact was found for id ${req.params.id}`,
                error: err
            });
        }

    
    },
    
    async updateContacts(req, res, next) {
        try {
            const data = await Contacts.findOneAndUpdate({ _id: req.params.id, owner: req.session.userID }, { $set: req.body, }, { new: true, });
            res.status(200).json({
                code: "200",
                message: "Update Contact",
                data: data,
            }
            )
        } catch (err) {
            return res.status(400).json({
                code: '400',
                Massage: `No contact was found for id ${req.params.id}`,
                error: err
            });
        }

    },
    async updateStatusContact(req, res, next) {
        try {
            const data = await Contacts.findOneAndUpdate({ _id: req.params.id, owner: req.session.userID }, { $set: req.body, }, { new: true, });
            res.status(200).json({
                code: "200",
                message: "Update Favorite",
                data: data,
            }
            )
        } catch (err) {
            return res.status(400).json({
                code: '400',
                Massage: `No contact was found for id ${req.params.id}`,
                error: err
            });
        }
    },
       
       
    async createUser(req, res, next) {
        const { error, value } = userschemaJoi.validate(req.body, { abortEarly: false })
        if (error) {
            return res.status(400).json({
                message: "Bad Request",
                data: error
            });
        } else {
            const { password, email, subscription } = value;

            const user = await Users.findOne({ email });
            if (user) {
                return res.status(409).json({
                    status: 'error',
                    code: 409,
                    message: 'Email is already in use',
                    data: 'Conflict',
                });
            }
            try {







                const url = gravatar.url(email, { s: '200', r: 'pg', d: '404' });

                const hashed = await bcrypt.hash(password, saltRounds)
                const token = jwt.sign({ email }, process.env.JWT_privateKey, { expiresIn: '1h', })
                const newUser = new Users({ password: hashed, email: email, subscription: subscription, token: token, avatarURL: url,verify: false, verificationToken: uuidv4(),});
                await newUser.save();
            verifyemail(newUser)

                // req.session.userToken = token;
                // req.session.userID = newUser._id
                
                res.status(201).json({
                    status: 'success',
                    code: 201,
                    data: {
                        message: 'Registration successful',
                    },
                });
            } catch (error) {
                next(error);
            }
        }
    },

    async userLogin(req, res, next) {
      
        const { error } = userschemaJoi.validate(req.body, { abortEarly: false })
        if (error) {
            return res.status(400).json({
                message: "Bad Request",
                data: error
            });
        } else {
            const { password, email } =req.body;
            const user = await Users.findOne({ email });
            
            if (!user) {
                return res.status(401).json({
                    message: "Email not found",
                });
            }
            if (user && user.verify === false) {
     return res.status(401).json({
                    message: "Unauthorized Account has not been Varified",
                });
}
            const validatePw = await user.checkPassword(password)
            if (!validatePw) {
                return res.status(401).json({
                    message: `Password is incorrect for email ${email}`,
                });
            } 
            const token = jwt.sign({ email }, process.env.JWT_privateKey, { expiresIn: '1h', })
            user.token = token;
            await user.save()
            req.session.userToken = token;
            req.session.userID = user._id
            return res.status(200).json({
                code: "200",
                message: "Login Successful"
                // token: token,
                // data: user
            });
        }
    },
    async userLogout(req, res, next) {
        if (req.session.userToken) {
            req.session.destroy(() => {
                res.json({ message: 'User was signed out' });
            });
        } else {
            res.json({ message: 'You are already signed out' });
        }

    },
    async userCurrent(req, res, next) {
        if (!req.session.userToken) {
            return res.status(401).json({
                status: 'error',
                code: 401,
                message: 'Unauthorized',
                
            });
         
        }
        const user = await Users.findOne({ token: req.session.userToken }).select('email subscription -_id')
        if (user) {
            return res.status(200).json({
                code: 200,
                data: user,
                
            });
        }

    },
 
    
    async patchUser(req, res, next) {
        if (!req.session.userToken) {
            return res.status(401).json({
                status: 'error',
                code: 401,
                message: 'Unauthorized',
                
            });
         
        } else {

            const { error, value } = subscriptionJoi.validate(req.body, { abortEarly: false })
           
            if (error) {
                return res.status(400).json({
                    message: "Invalid Subscription entered",
                    data: error
                });
            } else {
                const data = await Users.findOneAndUpdate({ _id: req.session.userID }, { $set: value, }, { new: true, }).select('email subscription -_id');
                return res.status(200).json({
                    code: 200,
                    data: data,
                });


            }

        }
    },

    async uploadFile(req, res) {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                cb(null, file.originalname);
            },
           
        });
        const upload = multer({
            storage: storage,
            limits: {
                fileSize: 1048576,
            },
        });
        
        upload.single('picture')(req, res, async function (err) {
            if (err) {
                 return res.status(400).json({
                code: '400',
                Massage: "An error has accurred",
                error: err,
            });
            }
            const { path: tempName } = req.file;
                await Jimp.read(tempName)
                    .then((image) => {
                        return image
                            .resize(256, 256) // resize
                            .write(tempName); // save
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            const ext = path.extname(tempName);
            const fileName = path.join(imagesPath, req.session.userID  + ext)
            await fs.rename(tempName, fileName)
            const data = await Users.findOneAndUpdate({ _id: req.session.userID }, { $set: {avatarURL: fileName}, }, { new: true, }).select('email subscription avatarURL -_id');
return res.status(200).json({
                    code: 200,
                    data: data,
                });
        })   
    },

    async userVerification(req, res) {
        try {
            await Users.findOneAndUpdate({ verificationToken: req.params.verificationToken },{ $set: {verificationToken: null, verify: true }, }, { new: true, });
            return res.status(200).json({
                code: "200",
                message: 'Verification successful',
            }
            )
            
        } catch (err) {
          return  res.status(404).json({
                code: '404',
                message: 'User not found'
            });
        }
    },

    async resendemail(req, res) {
        const { email } = req.body;
        if (!email) {
             return  res.status(400).json({
                code: '400',
                message: 'missing required field email'
            });
        }
         try {
             const data = await Users.findOne({ email: email });
             if (data.verify === false) {
                 const newUser = new Users({ email: data.email, verificationToken: data.verificationToken, });
                 verifyemail(newUser)
                 res.status(200).json({
                     code: "200",
                     message: "Verification email sent",
                     
                 }
                 )
             } else {
                 res.status(400).json({
                     code: "400",
                     message: "Verification has already been passed",
                    
                 })
                }
        } catch (err) {
            res.status(400).json({
                code: '400',
                Massage: `No user was found for email ${email}`,
                error: err,
            });
        }

        
    },
}

module.exports= contactController