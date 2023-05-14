//jshint esversion:6
const express=require('express');
const bodyParserr=require('body-parser');
const ejs=require('ejs');
const mongoose=require('mongoose');
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const { URL } = require('url');
const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');


const app=express();



app.use(express.static("public"));
app.set('view engine','ejs');

app.use(bodyParserr.urlencoded({
  extended:true
}));

app.use(session({
  secret:""//Put a string of that must be kept private,
  resave: false,
  saveUninitialized:false
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.set('strictQuery',false);
mongoose.connect('mongodb://127.0.0.1/userDB',{useNewUrlParser: true});

const userSchema=new mongoose.Schema({
  email:String,
  password:String
});
const pollSchema=new mongoose.Schema({
  question:String,
  choices:[{
    choice: {
  type: String,
  required: true
},
votes: {
  type: Number,
  default: 0
}
}],
  votedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date }
});
const Poll=mongoose.model("Poll",pollSchema);

userSchema.plugin(passportLocalMongoose);

const User=new mongoose.model("User",userSchema);

passport.use(User.createStrategy());
// passport.serializeUser(Voter.serializeUser());
// passport.deserializeUser(Voter.deserializeUser());

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id, (err,user) => {
        done(err, user);
    });
})


app.get("/",function(req,res){
  res.render("home");
});

app.get("/poll",function(req,res){
  res.render("poll");
})
app.get("/link",function(req,res){
  res.render("link");
})
app.get("/login",function(req,res){
  res.render("login");
});



app.get("/register",function(req,res){
  res.render("register");
});


app.get("/vote",function(req,res){
  if(req.isAuthenticated()){
    res.render("vote");
  }else{
    res.redirect("/login");
  }
});

app.get("/logout",function(req,res){
  req.logout(function(err){
    if(err){
      console.log(err);
    }else{
        res.redirect("/");
    }
  });

});

app.get("/bowl",function(req,res){
  res.render("bowl");
})
app.get("/bat",function(req,res){
  res.render("bat");
})
app.get("/allrounder",function(req,res){
  res.render("allrounder");
})

app.post("/register",function(req,res){
  // const speakeasy = require('speakeasy');
  // const nodemailer = require('nodemailer');
  //
  // // Generate random OTP
  // const otp = speakeasy.totp({
  //   secret: speakeasy.generateSecret().base32,
  //   digits: 6
  // });
  //
  // // Configure nodemailer transport object
  // const transport = nodemailer.createTransport({
  //   host: 'smtp.gmail.com',
  //   port: 465,
  //   secure: true,
  //   auth: {
  //     user:
  //     pass:
  //   }
  // });
  // // const answer=req.body.username;
  // // Set up email options
  // // console.log(req.body.username);
  // const mailOptions = {
  //   from: '',
  //   to: req.body.username,
  //   subject: 'OTP for Registration',
  //   text: `Your OTP for registration is ${otp}`
  // };
  //
  // // Send email
  // transport.sendMail(mailOptions, (error, info) => {
  //   if (error) {
  //     console.log(error);
  //   } else {
  //     console.log('Email sent: ' + info.response);
  //   }
  // });

  User.register({username: req.body.username},req.body.password,function(err,user){
    if(err){
      console.log(err);
      res.redirect("/register");
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/vote");
      })
    }
  })

});
app.post("/login",function(req,res){

   const user=new User({
     username:req.body.username,
     password: req.body.password
   });

   req.login(user,function(err){
     if(err){
       console.log(err);
     }else{
       passport.authenticate("local")(req,res,function(){
         res.redirect("/vote");
       })
     }
   })
});
app.post("/create_poll",function(req,res){


// Use the labels values here
console.log(req.body.num_labels);
const labels = [];
// loop through all dynamic label inputs in the request body
for (let i = 1; i <= req.body.num_labels; i++) {
   labels.push({choice:req.body['label_' + i],votes:0});
}


  // console.log(req.body);
  const poll=new Poll({
    question:req.body.question,
    choices:labels,
    votedBy: [],
    expiresAt: new Date(Date.now() + req.body.time* 60 * 1000)
  });
  // console.log(poll.choices);
  poll.save(function(err) {
  if (err) {
    console.log('Error saving poll:', err);
    return next(err);
  }
  const pollUrl = req.protocol + '://' + req.get('host') + '/poll/' + poll._id;
  res.render("copy",{ pollUrl: pollUrl });
});

})



app.post("/vote_poll",function(req,res){

   const pollUrl=req.body.voteit;
   console.log(pollUrl);
   if(pollUrl.length==0){
     console.log("Kindly paste the link sent by the poller");
     // alert("err")
     res.send("<h1> Kindly paste the link sent by the poller..</h1>")
   }
   const urlObj = new URL(pollUrl);
const pathname = urlObj.pathname;

// Extract the poll ID from the pathname
const pollId = pathname.split('/').pop();
Poll.findOne({_id:pollId},function(err,result){


  if(err){
    console.log(err);
  }else{
    console.log(result.choices);
    // res.send("<%=<h1>  result.question</h1> %> ")
    res.render("votekaro.ejs",{result:result.choices,question: result.question})
  }
})
console.log(pollId); // Output: 123456

})

app.post("/submitkaro", function(req, res) {
  const pollId = req.body.option;
  const userId = req.user._id; // assuming you are using passport for authentication
  console.log(userId);
  Poll.findOne({"choices._id": pollId}, function(err, result) {
    if (err) {
      console.log(err);
      res.send("Error finding poll option");
    } else {
      const alreadyVoted = result.votedBy.includes(userId);

     if(new Date() > result.expiresAt){
             res.render("result",{result:result});
      }else if (alreadyVoted) {
          res.render("onlyone");
        }else {
        let i = 0;
        let choice = "";
        for (i = 0; i < result.choices.length; i++) {
          if (result.choices[i]._id == pollId) {
            result.choices[i].votes++;
            choice = result.choices[i].choice;
            break;
          }
        }

        result.votedBy.push(userId); // add user ID to votedBy array

        result.save(function(err, savedResult) {
          if (err) {
            console.log(err);
            res.send("Error updating vote count");
          } else {
            console.log(savedResult);
            // res.send("Poll option found: " + choice + ", vote count increased to: " + savedResult.choices[i].votes);
            res.render("aftervote");
          }
        });
      }
    }
  });
});









app.post("/submit",function(req,res){
  console.log(req.body.option);
  const selectedColor = req.body.option
console.log(`Selected color: ${selectedColor}`)
res.send(`You selected ${selectedColor}`)
})

app.listen(3000,function(){
  console.log("Server started on port 3000");
})
