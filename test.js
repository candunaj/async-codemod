let a = (user) => {
  s.abc()
    .my.user.then((result) => {
      console.log("test");
    })
    .then((res2) => {
      return res2 + 3;
    });
};

let bba = function (user) {
  return user().then((result) => {
    if (true) {
      return bbb.then((res2) => {
        return res2 + 2;
      });
    }
  });
};

let c = (user) => {
  return new Ember.RSVP.Promise((resolve, reject) => {
    user.then((result) => {
      resolve(result);
    }, reject);
    let b = 5;
    let a = b + 2;
  });
};

function b() {
  return new Ember.RSVP.Promise((resolve, reject) => {
    let a = 2;
    let b = 2 + a;
    return aaa
      .then((result) => {
        return result.xxx();
      })
      .then((res2) => {
        resolve(res2.yyy());
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
}

function bb() {
  return new Promise((resolve, reject) => {
    let a = 2;
    let b = 2 + a;
    return aaa
      .then((result) => {
        a = a + 2;
        return result.xxx();
      })
      .then((res2) => {
        a = a + 3;
        return res2.yyy().then((res3) => {
          resolve(a);
        });
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      })
      .finally(() => {
        console.log("finally");
      });
  });
}
