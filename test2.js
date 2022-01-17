function aaa() {
  return new Promise((resolve, reject) => {
    this.save()
      .then(a)
      .then(b)
      .then(resolve)
      .catch((err) => {
        return reject2(err);
      });
  });
}
